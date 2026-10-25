"""Outbound URL policy (STEP-20 / F-019, F-020).

The copilot accepts a `base_url` from the caller for the `custom` and `ollama`
providers. Without a policy that turns the backend into an open HTTP proxy: any
caller could point it at `http://169.254.169.254/` (cloud metadata), at a router
admin page, or at another loopback service, and read the response back through the
model-discovery endpoint.

`validate_outbound_url` is the single choke point. It checks the *resolved* address,
not the string, so `http://127.1`, `http://0x7f000001` and a DNS name that rebinds to
a private address are all caught by the same rule.

Nothing here is a quota or an identity check: STEP-05 covers who may call the API.
This module only bounds *what an accepted request can reach*.
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlsplit

__all__ = ["UrlNotAllowed", "validate_outbound_url"]

_ALLOWED_SCHEMES = frozenset({"http", "https"})

#: Denied regardless of `allow_private`: ranges that never host a legitimately
#: user-configured model server.
_ALWAYS_DENIED: tuple[tuple[ipaddress.IPv4Network | ipaddress.IPv6Network, str], ...] = (
    (ipaddress.ip_network("0.0.0.0/8"), "host resolved to the unspecified range"),
    (ipaddress.ip_network("169.254.0.0/16"), "host resolved to a link-local address"),
    (ipaddress.ip_network("224.0.0.0/4"), "host resolved to a multicast address"),
    (ipaddress.ip_network("240.0.0.0/4"), "host resolved to a reserved address"),
    (ipaddress.ip_network("fe80::/10"), "host resolved to a link-local address"),
    (ipaddress.ip_network("ff00::/8"), "host resolved to a multicast address"),
)

#: Permitted only when `allow_private=True` — the documented `custom` / `ollama`
#: use case (a model server on the same machine or the same LAN).
_PRIVATE_ALLOWED: tuple[ipaddress.IPv4Network | ipaddress.IPv6Network, ...] = (
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
)


class UrlNotAllowed(ValueError):
    """Raised when an outbound URL is outside the permitted address space.

    Subclasses `ValueError` on purpose: the API layer already maps `ValueError` to a
    `400`, and callers that only know about `ValueError` keep working.
    """


def _check_address(raw: str, *, allow_private: bool) -> None:
    """Raise `UrlNotAllowed` unless `raw` is an address the policy permits.

    The offending address is deliberately *not* included in the message: the text is
    returned to the client (spec 7/11), and echoing a resolved address back is how an
    endpoint becomes a cheap scanner.
    """
    try:
        # Scope ids (`fe80::1%eth0`) are valid in sockaddr but not in `ip_address`.
        address = ipaddress.ip_address(raw.split("%", 1)[0])
    except ValueError as exc:  # pragma: no cover - getaddrinfo always yields a literal
        raise UrlNotAllowed("host did not resolve to an IP address") from exc

    for network, reason in _ALWAYS_DENIED:
        if address.version == network.version and address in network:
            raise UrlNotAllowed(reason)

    if allow_private:
        for network in _PRIVATE_ALLOWED:
            if address.version == network.version and address in network:
                return

    # Everything else that is not globally routable: RFC1918 (when private is not
    # allowed), loopback, CGNAT 100.64/10, TEST-NET 192.0.2.0/24, benchmarking
    # 198.18/15, ULA fc00::/7 without the private opt-in, and so on.
    if not address.is_global:
        raise UrlNotAllowed("host resolved to a non-routable address")


def validate_outbound_url(url: str, *, allow_private: bool = False) -> str:
    """Return `url` without a trailing slash, or raise `UrlNotAllowed`.

    Args:
        url: absolute `http`/`https` URL a request is about to be sent to.
        allow_private: permit loopback, RFC1918 and unique-local addresses. Only the
            local providers (`custom`, `ollama`) pass `True`; a cloud endpoint never
            needs to reach the machine's own network.
    """
    text = (url or "").strip()
    if not text:
        raise UrlNotAllowed("URL is empty")

    split = urlsplit(text)
    if split.scheme.lower() not in _ALLOWED_SCHEMES:
        raise UrlNotAllowed("scheme must be http or https")
    if "@" in split.netloc:
        # `http://user:pass@host/` hides the real host from every casual reader and
        # leaks a credential into the URL, which lands in httpx logs.
        raise UrlNotAllowed("credentials in the URL are not allowed")

    host = split.hostname
    if not host:
        raise UrlNotAllowed("URL must include a host")

    try:
        port = split.port
    except ValueError as exc:
        raise UrlNotAllowed("URL has an invalid port") from exc
    if port is not None and not 0 < port < 65536:
        raise UrlNotAllowed("URL has an invalid port")

    # A literal address needs no DNS: skipping `getaddrinfo` keeps the rejection
    # synchronous and independent of the machine's resolver (and of its latency).
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None

    if literal is not None:
        _check_address(str(literal), allow_private=allow_private)
    else:
        default_port = 443 if split.scheme.lower() == "https" else 80
        try:
            infos = socket.getaddrinfo(
                host, port or default_port, proto=socket.IPPROTO_TCP
            )
        except socket.gaierror as exc:
            raise UrlNotAllowed("host could not be resolved") from exc
        except UnicodeError as exc:  # malformed IDNA name
            raise UrlNotAllowed("host could not be resolved") from exc

        if not infos:
            raise UrlNotAllowed("host could not be resolved")
        for info in infos:
            _check_address(str(info[4][0]), allow_private=allow_private)

    return text.rstrip("/")
