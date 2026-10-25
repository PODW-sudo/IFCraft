"""Server-side WebSocket heartbeat (open issue 3.3).

Without a heartbeat a half-open connection (closed laptop lid, VPN drop, suspended VM) keeps
its room session and every soft lock it holds until TCP itself gives up — which can be minutes.
A socket that stops answering now releases its session and locks within
``settings.WS_IDLE_TIMEOUT_SECONDS``.

Contract (wire shapes are additive; STEP-13's protocol is unchanged):

* the server sends ``{"type": "PING", "ts": <unix ms>}`` every
  ``settings.WS_PING_INTERVAL_SECONDS``;
* *any* inbound frame counts as liveness — in practice the client answers
  ``{"type": "PONG"}`` — and refreshes ``last_seen``;
* sending a PING does **not** refresh ``last_seen``, otherwise a half-open socket would keep
  itself alive just by being written to;
* ``WS_IDLE_TIMEOUT_SECONDS`` without an inbound frame closes the socket with 1001 (going
  away), so the room's ``finally`` block releases the locks and tells the other clients.

The class is deliberately clock- and sleep-injectable: the unit test advances a fake clock
instead of waiting 25 real seconds.
"""

import asyncio
import json
import logging
import time

from ..core.config import settings

logger = logging.getLogger("ifc_editor.ws_heartbeat")

PING_MESSAGE_TYPE = "PING"
PONG_MESSAGE_TYPE = "PONG"

# "Going away": the peer did not answer, it is not a policy violation and not a clean close.
IDLE_CLOSE_CODE = 1001


def ping_payload(now: float | None = None) -> str:
    """Wire frame for a heartbeat: ``{"type": "PING", "ts": <unix ms>}``."""
    moment = now if now is not None else time.time()
    return json.dumps({"type": PING_MESSAGE_TYPE, "ts": int(moment * 1000)})


def pong_payload(now: float | None = None) -> str:
    """Client answer. Kept here so both sides of the contract live in one place."""
    moment = now if now is not None else time.time()
    return json.dumps({"type": PONG_MESSAGE_TYPE, "ts": int(moment * 1000)})


class SocketHeartbeat:
    """Per-socket ping/idle watchdog.

    ``clock`` must be monotonic (defaults to ``time.monotonic``) — wall-clock jumps must not
    revive or kill a socket. ``sleep`` is injectable for the same reason as the clock.
    """

    def __init__(
        self,
        websocket,
        *,
        ping_interval: float | None = None,
        idle_timeout: float | None = None,
        clock=time.monotonic,
        sleep=asyncio.sleep,
    ):
        self.websocket = websocket
        self.ping_interval = float(
            ping_interval if ping_interval is not None else settings.WS_PING_INTERVAL_SECONDS
        )
        self.idle_timeout = float(
            idle_timeout if idle_timeout is not None else settings.WS_IDLE_TIMEOUT_SECONDS
        )
        if self.ping_interval <= 0 or self.idle_timeout <= 0:
            raise ValueError("heartbeat intervals must be positive")

        self._clock = clock
        self._sleep = sleep
        self._last_seen = clock()
        self._last_ping = clock()
        self._pings_sent = 0
        self.closed_for_idle = False

    # -- test/diagnostic surface -------------------------------------------------------------
    @property
    def pings_sent(self) -> int:
        return self._pings_sent

    @property
    def idle_for(self) -> float:
        """Seconds since the last inbound frame (PINGs do not count)."""
        return self._clock() - self._last_seen

    @property
    def since_ping(self) -> float:
        return self._clock() - self._last_ping

    # -- behaviour ---------------------------------------------------------------------------
    def touch(self) -> None:
        """Record an inbound frame. Call this for *every* received frame, PONG included."""
        self._last_seen = self._clock()

    def is_idle(self) -> bool:
        return self.idle_for >= self.idle_timeout

    def tick_seconds(self) -> float:
        """How long to sleep between checks.

        A quarter of the shorter window: fine enough to honour the PING cadence and to close
        close to the idle deadline, without a busy loop.
        """
        return max(0.001, min(self.ping_interval, self.idle_timeout) / 4.0)

    async def run(self, max_ticks: int | None = None) -> None:
        """Ping and police idleness until cancelled (or until the socket is closed).

        ``max_ticks`` exists for the unit test; production calls it unbounded.
        """
        ticks = 0
        while max_ticks is None or ticks < max_ticks:
            await self._sleep(self.tick_seconds())
            ticks += 1

            if self.is_idle():
                self.closed_for_idle = True
                logger.info(
                    "Closing idle WebSocket after %.1fs without a frame (limit %.1fs)",
                    self.idle_for,
                    self.idle_timeout,
                )
                try:
                    await self.websocket.close(code=IDLE_CLOSE_CODE)
                except Exception as err:  # already gone
                    logger.debug("Idle close failed: %s", err)
                return

            if self.since_ping >= self.ping_interval:
                try:
                    await self.websocket.send_text(ping_payload())
                except Exception as err:  # the receive loop will notice the disconnect
                    logger.debug("Could not send heartbeat PING: %s", err)
                    return
                self._last_ping = self._clock()
                self._pings_sent += 1
