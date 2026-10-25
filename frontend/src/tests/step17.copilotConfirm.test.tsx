/**
 * STEP-17 - Copilot write confirmation (frontend half).
 *
 * The backend contract (`backend/tests/test_step17_copilot_intent.py`) proves the server
 * withholds model-writing tools. This file proves the panel actually uses that protocol:
 * a first send must be a dry run, a `requires_confirmation` reply must render a
 * confirm/cancel pair, confirming must replay the same prompt with `confirm_writes: true`,
 * and reported `errors` must be visible instead of silent.
 *
 * STEP-27 landed the test harness this file needed (vitest + jsdom + testing-library).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { CopilotChatResponse } from '../types/ifc';

const apiMocks = vi.hoisted(() => ({
  sendCopilotChat: vi.fn(),
  fetchCopilotProviders: vi.fn(),
  fetchCopilotModels: vi.fn()
}));

vi.mock('../services/api', () => ({
  sendCopilotChat: apiMocks.sendCopilotChat,
  fetchCopilotProviders: apiMocks.fetchCopilotProviders,
  fetchCopilotModels: apiMocks.fetchCopilotModels
}));

import { CopilotSidebar } from '../components/copilot/CopilotSidebar';

const WITHHELD_RESPONSE: CopilotChatResponse = {
  message: {
    role: 'assistant',
    content: '**Confirmation required.** This request would change the model, so nothing has been written yet.'
  },
  tool_calls: [],
  project_updated: false,
  requires_confirmation: true,
  pending_tool_calls: [
    {
      name: 'generate_building',
      arguments: { num_storeys: 1, length: 6, width: 5 }
    }
  ],
  errors: []
};

const EXECUTED_RESPONSE: CopilotChatResponse = {
  message: { role: 'assistant', content: 'Generated 1-storey building (6m x 5m).' },
  tool_calls: [
    {
      id: 'call_1',
      name: 'generate_building',
      arguments: { num_storeys: 1, length: 6, width: 5 },
      result: { success: true, summary: 'Generated a 1-storey building.' }
    }
  ],
  project_updated: true,
  requires_confirmation: false,
  pending_tool_calls: [],
  errors: []
};

const FAILED_RESPONSE: CopilotChatResponse = {
  message: {
    role: 'assistant',
    content: '**Tool failure.** The requested change was not applied:'
  },
  tool_calls: [
    {
      id: 'call_2',
      name: 'transform_element',
      arguments: { element_id: 999999, dx: 1 },
      result: { error: 'Entity #999999 not found.' }
    }
  ],
  project_updated: false,
  requires_confirmation: false,
  pending_tool_calls: [],
  errors: [{ tool: 'transform_element', message: 'Entity #999999 not found.' }]
};

function renderSidebar(onModelModified = vi.fn()) {
  return {
    onModelModified,
    ...render(
      <CopilotSidebar
        isOpen
        onClose={() => {}}
        projectId="project-step17"
        selectedExpressId={null}
        onModelModified={onModelModified}
      />
    )
  };
}

async function send(text: string) {
  const input = screen.getByPlaceholderText('Ask Copilot or type a command...');
  fireEvent.change(input, { target: { value: text } });
  const sendBtn = document.querySelector('[data-qa="copilot-send-btn"]') as HTMLButtonElement;
  fireEvent.click(sendBtn);
}

describe('STEP-17 copilot write confirmation', () => {
  beforeEach(() => {
    // jsdom does not implement scrollIntoView; the panel scrolls its message feed on mount.
    Element.prototype.scrollIntoView = vi.fn();
    apiMocks.fetchCopilotProviders.mockResolvedValue([
      {
        id: 'local',
        name: 'Built-in Assistant',
        models: ['built-in'],
        default_model: 'built-in',
        requires_api_key: false
      }
    ]);
    apiMocks.fetchCopilotModels.mockResolvedValue({
      provider: 'local',
      models: ['built-in'],
      default_model: 'built-in',
      source: 'api',
      connected: true,
      error: null
    });
  });

  afterEach(() => {
    apiMocks.sendCopilotChat.mockReset();
  });

  it('sends the first message as a dry run (confirm_writes: false)', async () => {
    apiMocks.sendCopilotChat.mockResolvedValueOnce(WITHHELD_RESPONSE);
    renderSidebar();

    await send('generate a 1-storey building 6m by 5m');

    await waitFor(() => expect(apiMocks.sendCopilotChat).toHaveBeenCalledTimes(1));
    expect(apiMocks.sendCopilotChat.mock.calls[0][0]).toMatchObject({
      confirm_writes: false,
      project_id: 'project-step17'
    });
  });

  it('renders a confirm/cancel pair when the server withheld a write', async () => {
    apiMocks.sendCopilotChat.mockResolvedValueOnce(WITHHELD_RESPONSE);
    renderSidebar();

    await send('generate a 1-storey building 6m by 5m');

    expect(await screen.findByText('Confirm write')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText(/generate_building/)).toBeInTheDocument();
  });

  it('replays the prompt with confirm_writes: true when the user confirms', async () => {
    apiMocks.sendCopilotChat
      .mockResolvedValueOnce(WITHHELD_RESPONSE)
      .mockResolvedValueOnce(EXECUTED_RESPONSE);
    const { onModelModified } = renderSidebar();

    await send('generate a 1-storey building 6m by 5m');
    fireEvent.click(await screen.findByText('Confirm write'));

    await waitFor(() => expect(apiMocks.sendCopilotChat).toHaveBeenCalledTimes(2));
    const secondRequest = apiMocks.sendCopilotChat.mock.calls[1][0];
    expect(secondRequest.confirm_writes).toBe(true);
    // The same prompt must be replayed: no duplicate user turn, prompt still last.
    expect(secondRequest.messages[secondRequest.messages.length - 1]).toEqual({
      role: 'user',
      content: 'generate a 1-storey building 6m by 5m'
    });
    expect(
      secondRequest.messages.filter(
        (m: { role: string; content: string }) =>
          m.role === 'user' && m.content === 'generate a 1-storey building 6m by 5m'
      )
    ).toHaveLength(1);

    expect(await screen.findByText('Generated 1-storey building (6m x 5m).')).toBeInTheDocument();
    expect(onModelModified).toHaveBeenCalledTimes(1);
    // The resolved proposal can no longer be confirmed twice.
    await waitFor(() => expect(screen.queryByText('Confirm write')).not.toBeInTheDocument());
  });

  it('cancels without writing anything', async () => {
    apiMocks.sendCopilotChat.mockResolvedValueOnce(WITHHELD_RESPONSE);
    const { onModelModified } = renderSidebar();

    await send('generate a 1-storey building 6m by 5m');
    fireEvent.click(await screen.findByText('Cancel'));

    await waitFor(() => expect(screen.queryByText('Confirm write')).not.toBeInTheDocument());
    expect(apiMocks.sendCopilotChat).toHaveBeenCalledTimes(1);
    expect(onModelModified).not.toHaveBeenCalled();
  });

  it('renders tool errors inline instead of reporting a silent success', async () => {
    apiMocks.sendCopilotChat.mockResolvedValueOnce(FAILED_RESPONSE);
    const { onModelModified } = renderSidebar();

    await send('move element #999999 by 1 meter on x');

    const block = await screen.findByText(/Entity #999999 not found/);
    expect(block).toBeInTheDocument();
    expect(screen.getByText('Tool error')).toBeInTheDocument();
    // Named in both the tool-call block and the error block; either way it is visible.
    expect(screen.getAllByText('transform_element').length).toBeGreaterThan(0);
    expect(onModelModified).not.toHaveBeenCalled();
  });
});
