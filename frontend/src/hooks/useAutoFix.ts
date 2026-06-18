import { useState, useRef, useCallback } from 'react';
import { buildGraphDescription } from '../utils/generateCodeFromGraph';

export interface NodeData {
  id: string;
  type: string;
  label: string;
  params: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
}

export interface LogEntry {
  iteration: number;
  code: string;
  error: string | null;
  phase: 'generating' | 'verifying' | 'fixing' | 'success' | 'failed';
}

export interface ApiProgressEntry {
  id: number;
  message: string;
  status: 'active' | 'done' | 'error';
}

export interface GenerationRequestEntry {
  id: string;
  prompt: string;
  model: string;
  status: 'active' | 'done' | 'error';
  message: string;
  code: string;
  timestamp: number;
}

export interface PreviewTaskResult {
  code: string;
  language: 'threejs';
  nodes: NodeData[];
  edges: EdgeData[];
  refreshKey: number;
}

export interface HistoryEntry {
  id: string;
  prompt: string;
  code: string;
  nodes: NodeData[];
  edges: EdgeData[];
  language: 'threejs';
  model: string;
  timestamp: number;
  parentId?: string; // 子级记录：指向父级历史记录ID
  diffSummary?: string; // 相对父级的参数差异摘要
}

export type Phase = 'idle' | 'generating' | 'verifying' | 'fixing' | 'success' | 'failed';

const MAX_ATTEMPTS = 3;
const VERIFY_TIMEOUT = 15000;
const MAX_HISTORY = 50;

interface StreamResult {
  code: string;
  language?: 'threejs';
  nodes?: NodeData[];
  edges?: EdgeData[];
  error?: unknown;
}

async function readEventStream(
  response: Response,
  onProgress: (message: string) => void,
  onDelta: (text: string) => void,
): Promise<StreamResult> {
  if (!response.body) throw new Error('No response stream');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: StreamResult | null = null;

  const handleBlock = (block: string) => {
    const lines = block.split('\n');
    const eventLine = lines.find((line) => line.startsWith('event:'));
    const dataLines = lines.filter((line) => line.startsWith('data:'));
    if (!eventLine || dataLines.length === 0) return;

    const event = eventLine.slice(6).trim();
    const dataText = dataLines.map((line) => line.slice(5).trim()).join('\n');
    const data = JSON.parse(dataText);

    if (event === 'progress') onProgress(data.message || '');
    if (event === 'delta') onDelta(data.text || '');
    if (event === 'done') result = data;
    if (event === 'error') throw new Error(data.message || 'API stream failed');
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);
      if (block) handleBlock(block);
      boundary = buffer.indexOf('\n\n');
    }

    if (done) break;
  }

  if (buffer.trim()) handleBlock(buffer.trim());
  if (!result) throw new Error('API stream ended without a result');
  return result;
}

/** Compute a human-readable diff between two node sets */
function computeNodeDiff(
  oldNodes: NodeData[],
  newNodes: NodeData[],
): string {
  const diffs: string[] = [];
  const oldMap = new Map(oldNodes.map((n) => [n.label, n]));
  const newMap = new Map(newNodes.map((n) => [n.label, n]));

  for (const [label, newNode] of newMap) {
    const oldNode = oldMap.get(label);
    if (!oldNode) {
      diffs.push(`+${label}`);
      continue;
    }
    for (const [key, val] of Object.entries(newNode.params)) {
      const oldVal = oldNode.params[key];
      if (oldVal !== val && key !== 'interaction') {
        const oldStr = typeof oldVal === 'number' ? (oldVal as number).toFixed(2) : String(oldVal);
        const newStr = typeof val === 'number' ? (val as number).toFixed(2) : String(val);
        diffs.push(`${label}.${key}: ${oldStr}→${newStr}`);
      }
    }
  }
  for (const [label] of oldMap) {
    if (!newMap.has(label)) {
      diffs.push(`-${label}`);
    }
  }
  return diffs.slice(0, 6).join(', ') || '参数已更新';
}

/** Legacy graph helpers are kept only for existing history/parameter flows. */
function filterRelevantNodes(nodes: NodeData[], edges: EdgeData[]): NodeData[] {
  const infrastructureTypes = new Set(['scene', 'camera', 'renderer', 'comp_root', 'animation', 'responsive']);
  const connectedIds = new Set<string>();
  for (const e of edges) {
    connectedIds.add(e.source);
    connectedIds.add(e.target);
  }
  if (connectedIds.size === 0) return nodes.filter((n) => infrastructureTypes.has(n.type));
  return nodes.filter((n) => connectedIds.has(n.id) || infrastructureTypes.has(n.type));
}

function filterConnectedGraph(nodes: NodeData[], edges: EdgeData[]): { nodes: NodeData[]; edges: EdgeData[] } {
  const filteredNodes = filterRelevantNodes(nodes, edges);
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  return {
    nodes: filteredNodes,
    edges: edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)),
  };
}

export function useAutoFix() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [finalCode, setFinalCode] = useState<string | null>(null);
  const [finalNodes, setFinalNodes] = useState<NodeData[] | null>(null);
  const [finalEdges, setFinalEdges] = useState<EdgeData[]>([]);
  const [correctionLog, setCorrectionLog] = useState<LogEntry[]>([]);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [verificationKey, setVerificationKey] = useState(0);
  const [previewKey, setPreviewKey] = useState(0);
  const [generationKey, setGenerationKey] = useState(0);
  const [adjustExplanation, setAdjustExplanation] = useState<string | null>(null);
  const [apiProgress, setApiProgress] = useState<ApiProgressEntry[]>([]);
  const [streamedCode, setStreamedCode] = useState('');
  const [requestLog, setRequestLog] = useState<GenerationRequestEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeBaseHistoryId, setActiveBaseHistoryId] = useState<string | null>(null);
  const activeBaseRef = useRef<string | null>(null);
  const parentNodesSnapshotRef = useRef<NodeData[]>([]); // 父级节点原始快照，用于diff

  const attemptRef = useRef(1);
  const languageRef = useRef<'threejs'>('threejs');
  const nodesRef = useRef<NodeData[]>([]);
  const edgesRef = useRef<EdgeData[]>([]);
  const codeRef = useRef<string>('');
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPromptRef = useRef<string>('');
  const lastModelRef = useRef<string>('deepseekv4');
  const apiProgressIdRef = useRef(0);
  const isGeneratingRef = useRef(false);
  const hideGeneratedGraphRef = useRef(false);
  const activeRequestIdRef = useRef<string | null>(null);

  const resolveVisibleGraph = useCallback((
    apiNodes: NodeData[],
    apiEdges: EdgeData[],
    fallbackNodes: NodeData[],
    fallbackEdges: EdgeData[],
  ) => {
    if (hideGeneratedGraphRef.current) {
      return { nodes: [], edges: [] };
    }
    const nodesFromApi: NodeData[] = (apiNodes && apiNodes.length > 0) ? apiNodes : fallbackNodes;
    const edgesFromApi: EdgeData[] = (apiEdges && apiEdges.length > 0) ? apiEdges : fallbackEdges;
    return filterConnectedGraph(nodesFromApi, edgesFromApi);
  }, []);

  const clearVerifyTimer = useCallback(() => {
    if (verifyTimerRef.current) {
      clearTimeout(verifyTimerRef.current);
      verifyTimerRef.current = null;
    }
  }, []);

  const addLog = useCallback(
    (entry: { iteration: number; code: string; error: string | null; phase: LogEntry['phase'] }) => {
      setCorrectionLog((prev) => [...prev, entry]);
    },
    [],
  );

  const createRequestEntry = useCallback((prompt: string, model: string, message: string) => {
    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const entry: GenerationRequestEntry = {
      id,
      prompt,
      model,
      status: 'active',
      message,
      code: '',
      timestamp: Date.now(),
    };
    setRequestLog((prev) => [entry, ...prev].slice(0, 20));
    return id;
  }, []);

  const updateRequestById = useCallback((id: string, patch: Partial<GenerationRequestEntry>) => {
    setRequestLog((prev) => prev.map((item) => (
      item.id === id ? { ...item, ...patch } : item
    )));
  }, []);

  const appendRequestCodeById = useCallback((id: string, text: string) => {
    if (!text) return;
    setRequestLog((prev) => prev.map((item) => (
      item.id === id ? { ...item, code: item.code + text } : item
    )));
  }, []);

  const updateActiveRequest = useCallback((patch: Partial<GenerationRequestEntry>) => {
    const activeId = activeRequestIdRef.current;
    if (!activeId) return;
    setRequestLog((prev) => prev.map((item) => (
      item.id === activeId ? { ...item, ...patch } : item
    )));
  }, []);

  const appendActiveRequestCode = useCallback((text: string) => {
    const activeId = activeRequestIdRef.current;
    if (!activeId || !text) return;
    setRequestLog((prev) => prev.map((item) => (
      item.id === activeId ? { ...item, code: item.code + text } : item
    )));
  }, []);

  const resetApiProgress = useCallback((message: string) => {
    apiProgressIdRef.current = 1;
    setStreamedCode('');
    setApiProgress([{ id: 1, message, status: 'active' }]);
    const id = createRequestEntry(lastPromptRef.current, lastModelRef.current, message);
    activeRequestIdRef.current = id;
  }, [createRequestEntry]);

  const addApiProgress = useCallback((message: string) => {
    if (!message) return;
    setApiProgress((prev) => {
      const done = prev.map((item) => (
        item.status === 'active' ? { ...item, status: 'done' as const } : item
      ));
      apiProgressIdRef.current += 1;
      return [...done, { id: apiProgressIdRef.current, message, status: 'active' }];
    });
    updateActiveRequest({ message, status: 'active' });
  }, [updateActiveRequest]);

  const finishApiProgress = useCallback((message: string) => {
    setApiProgress((prev) => {
      const done = prev.map((item) => (
        item.status === 'active' ? { ...item, status: 'done' as const } : item
      ));
      apiProgressIdRef.current += 1;
      return [...done, { id: apiProgressIdRef.current, message, status: 'done' }];
    });
    updateActiveRequest({ message, status: 'done' });
  }, [updateActiveRequest]);

  const failApiProgress = useCallback((message: string) => {
    setApiProgress((prev) => {
      const done = prev.map((item) => (
        item.status === 'active' ? { ...item, status: 'error' as const } : item
      ));
      apiProgressIdRef.current += 1;
      return [...done, { id: apiProgressIdRef.current, message, status: 'error' }];
    });
    updateActiveRequest({ message, status: 'error' });
  }, [updateActiveRequest]);

  const callStreamApi = useCallback(
    async (url: string, body: Record<string, unknown>) => {
      addApiProgress('请求已发送，等待 API 返回');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, stream: true }),
      });
      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const errBody = await response.json();
          errorMsg = errBody.message || errBody.error || JSON.stringify(errBody);
        } catch {
          try { errorMsg = await response.text(); } catch { /* keep default */ }
        }
        throw new Error(errorMsg);
      }
      const result = await readEventStream(
        response,
        addApiProgress,
        (text) => {
          setStreamedCode((prev) => prev + text);
          appendActiveRequestCode(text);
        },
      );
      if (result.code) updateActiveRequest({ code: result.code });
      return result;
    },
    [addApiProgress, appendActiveRequestCode, updateActiveRequest],
  );

  const callStreamApiForRequest = useCallback(
    async (url: string, body: Record<string, unknown>, requestId: string) => {
      updateRequestById(requestId, {
        message: '请求已发送，等待 API 返回',
        status: 'active',
      });
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, stream: true }),
      });
      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const errBody = await response.json();
          errorMsg = errBody.message || errBody.error || JSON.stringify(errBody);
        } catch {
          try { errorMsg = await response.text(); } catch { /* keep default */ }
        }
        throw new Error(errorMsg);
      }
      const result = await readEventStream(
        response,
        (message) => updateRequestById(requestId, { message, status: 'active' }),
        (text) => appendRequestCodeById(requestId, text),
      );
      if (result.code) updateRequestById(requestId, { code: result.code });
      return result;
    },
    [appendRequestCodeById, updateRequestById],
  );

  // --- Save to history ---
  const saveToHistory = useCallback(
    (prompt: string, model: string) => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const code = codeRef.current;
      const language = languageRef.current;

      if (!code) return;

      const entry: HistoryEntry = {
        id: `hist_${Date.now()}`,
        prompt,
        code,
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        language,
        model,
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        const next = [entry, ...prev];
        return next.slice(0, MAX_HISTORY);
      });
    },
    [],
  );

  const restoreHistory = useCallback((entry: HistoryEntry) => {
    // 如果点击的是已激活的记录 → 取消选择
    if (activeBaseRef.current === entry.id) {
      setActiveBaseHistoryId(null);
      activeBaseRef.current = null;
      setAdjustExplanation(null);
      return;
    }

    codeRef.current = entry.code;
    languageRef.current = entry.language;
    nodesRef.current = JSON.parse(JSON.stringify(entry.nodes));
    edgesRef.current = JSON.parse(JSON.stringify(entry.edges));
    lastPromptRef.current = entry.prompt;
    lastModelRef.current = entry.model;

    setFinalCode(entry.code);
    setFinalNodes(entry.nodes);
    setFinalEdges(entry.edges);
    setPhase('success');
    setPreviewKey((k) => k + 1);
    setGenerationKey((k) => k + 1);
    setCorrectionLog([]);
    setActiveBaseHistoryId(entry.id);
    activeBaseRef.current = entry.id;
    parentNodesSnapshotRef.current = JSON.parse(JSON.stringify(entry.nodes));
    setAdjustExplanation(`已恢复历史记录: ${entry.prompt.slice(0, 50)}...（以此为起点调整将生成子级记录）`);
  }, []);

  const deleteHistory = useCallback((id: string) => {
    setHistory((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const resetProject = useCallback(() => {
    clearVerifyTimer();
    attemptRef.current = 1;
    languageRef.current = 'threejs';
    nodesRef.current = [];
    edgesRef.current = [];
    codeRef.current = '';
    lastPromptRef.current = '';
    lastModelRef.current = 'deepseekv4';
    activeBaseRef.current = null;
    parentNodesSnapshotRef.current = [];
    hideGeneratedGraphRef.current = false;

    setPhase('idle');
    setFinalCode(null);
    setFinalNodes(null);
    setFinalEdges([]);
    setCorrectionLog([]);
    setVerificationCode(null);
    setPreviewKey((k) => k + 1);
    setGenerationKey((k) => k + 1);
    setAdjustExplanation(null);
    setApiProgress([]);
    setStreamedCode('');
    setRequestLog([]);
    setHistory([]);
    setActiveBaseHistoryId(null);
  }, [clearVerifyTimer]);

  const moveToParent = useCallback((entryId: string, newParentId: string | null) => {
    setHistory((prev) => {
      const next = prev.map((e) => {
        if (e.id === entryId) {
          return { ...e, parentId: newParentId || undefined };
        }
        return e;
      });
      return next;
    });
  }, []);

  // --- Verify flow ---

  const startVerify = useCallback(
    (code: string) => {
      clearVerifyTimer();
      codeRef.current = code;
      setVerificationCode(code);
      setVerificationKey((k) => k + 1);
      setPhase('verifying');

      verifyTimerRef.current = setTimeout(() => {
        handleError('验证超时 (10s)');
      }, VERIFY_TIMEOUT);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const callFixApi = useCallback(
    async (code: string, error: string) => {
      setPhase('fixing');
      attemptRef.current += 1;

      addLog({
        iteration: attemptRef.current,
        code: '',
        error: null,
        phase: 'fixing',
      });

      try {
        resetApiProgress('正在准备自动修复请求');
        const result = await callStreamApi('/api/generate/fix', {
          code,
          error,
          language: languageRef.current,
          model: lastModelRef.current,
        });

        if (result.code) {
          const fixedCode = result.code;
          const apiNodes: NodeData[] = result.nodes || [];
          const apiEdges: EdgeData[] = result.edges || [];
          const { nodes: newNodes, edges: newEdges } = resolveVisibleGraph(
            apiNodes,
            apiEdges,
            nodesRef.current,
            edgesRef.current,
          );

          codeRef.current = fixedCode;
          nodesRef.current = newNodes;
          edgesRef.current = newEdges;

          addLog({
            iteration: attemptRef.current,
            code: fixedCode,
            error: null,
            phase: 'fixing',
          });

          // Show fixed code immediately, verify in background
          setFinalCode(fixedCode);
          setFinalNodes(newNodes);
          setFinalEdges(newEdges);
          setPhase('success');
          setPreviewKey((k) => k + 1);
          setGenerationKey((k) => k + 1);

          startVerify(fixedCode);
          finishApiProgress('修复代码已返回，正在后台验证');
        } else {
          setPhase('failed');
          failApiProgress('修复接口没有返回代码');
        }
      } catch (err) {
        console.error('修复请求失败:', err);
        setPhase('failed');
        failApiProgress(err instanceof Error ? err.message : '修复请求失败');
      }
    },
    [addLog, callStreamApi, failApiProgress, finishApiProgress, resetApiProgress, resolveVisibleGraph, startVerify],
  );

  const handleError = useCallback(
    (message: string) => {
      clearVerifyTimer();

      addLog({
        iteration: attemptRef.current,
        code: codeRef.current,
        error: message,
        phase: 'failed',
      });

      if (attemptRef.current >= MAX_ATTEMPTS) {
        setPhase('failed');
        setFinalCode(codeRef.current);
        setFinalNodes(nodesRef.current);
        setFinalEdges(edgesRef.current);
        setVerificationCode(null);
        return;
      }

      callFixApi(codeRef.current, message);
    },
    [addLog, callFixApi, clearVerifyTimer],
  );

  const handleSuccess = useCallback(() => {
    clearVerifyTimer();

    addLog({
      iteration: attemptRef.current,
      code: codeRef.current,
      error: null,
      phase: 'success',
    });

    // Preview is already showing (optimistic), just update phase
    setPhase('success');
    setVerificationCode(null);
  }, [addLog, clearVerifyTimer]);

  const startAutoFix = useCallback(
    async (prompt: string, model: string, files: File[] = []) => {
      if (isGeneratingRef.current) return;
      isGeneratingRef.current = true;
      attemptRef.current = 1;
      hideGeneratedGraphRef.current = true;
      lastPromptRef.current = prompt;
      lastModelRef.current = model;
      setCorrectionLog([]);
      setAdjustExplanation(null);
      setActiveBaseHistoryId(null);
      activeBaseRef.current = null;
      setPhase('generating');
      setGenerationKey((k) => k + 1);
      resetApiProgress('正在准备生成请求');

      try {
        // Build file info for the AI
        const fileNames = files.map((f) => f.name);
        const fileInfo = fileNames.length > 0
          ? `\n已上传文件: ${fileNames.join(', ')}\n如需使用素材，请在代码和节点注释中标注文件引用。`
          : '';

        const result = await callStreamApi('/api/generate/text', { prompt: prompt.trim() + fileInfo, model });

        if (result.code) {
          const code = result.code;
          const language: 'threejs' =
            result.language || 'threejs';
          // 生成预览时不再把 API 解析出的 @node/@connect 映射成画布节点。
          // 画布只保留用户创建的文本/图像节点和预览节点。
          const nodes: NodeData[] = [];
          const edges: EdgeData[] = [];

          languageRef.current = language;
          const { nodes: filteredNodes, edges: filteredEdges } = filterConnectedGraph(nodes, edges);
          nodesRef.current = filteredNodes;
          edgesRef.current = filteredEdges;

          addLog({
            iteration: 1,
            code,
            error: null,
            phase: 'generating',
          });

          // Show preview IMMEDIATELY (optimistic)
          // 不再进行后台验证 — 验证会导致不必要的自动修复和黑屏
          setFinalCode(code);
          setFinalNodes(filteredNodes);
          setFinalEdges(filteredEdges);
          setPhase('success');
          setPreviewKey((k) => k + 1);
          setGenerationKey((k) => k + 1);
          saveToHistory(prompt.trim(), model);
          finishApiProgress('代码已返回，预览已更新');
        } else {
          console.error('生成失败:', result.error);
          setPhase('failed');
          failApiProgress('生成接口没有返回代码');
        }
        isGeneratingRef.current = false;
      } catch (err) {
        console.error('请求失败:', err);
        setPhase('failed');
        failApiProgress(err instanceof Error ? err.message : '生成请求失败');
        isGeneratingRef.current = false;
      }
    },
    [addLog, callStreamApi, failApiProgress, finishApiProgress, resetApiProgress, saveToHistory, startVerify],
  );

  const startPreviewTask = useCallback(
    async (prompt: string, model: string, files: File[] = []): Promise<PreviewTaskResult> => {
      const trimmedPrompt = prompt.trim();
      const requestId = createRequestEntry(trimmedPrompt, model, '正在准备生成请求');
      try {
        const fileNames = files.map((f) => f.name);
        const fileInfo = fileNames.length > 0
          ? `\n已上传文件: ${fileNames.join(', ')}\n如需使用素材，请在代码和节点注释中标注文件引用。`
          : '';
        const result = await callStreamApiForRequest('/api/generate/text', {
          prompt: trimmedPrompt + fileInfo,
          model,
        }, requestId);

        if (!result.code) {
          throw new Error('生成接口没有返回代码');
        }

        const taskResult: PreviewTaskResult = {
          code: result.code,
          language: result.language || 'threejs',
          nodes: result.nodes || [],
          edges: result.edges || [],
          refreshKey: Date.now(),
        };
        updateRequestById(requestId, {
          code: taskResult.code,
          message: '代码已返回，预览已更新',
          status: 'done',
        });
        return taskResult;
      } catch (err) {
        updateRequestById(requestId, {
          message: err instanceof Error ? err.message : '生成请求失败',
          status: 'error',
        });
        throw err;
      }
    },
    [callStreamApiForRequest, createRequestEntry, updateRequestById],
  );

  const startPreviewAdjustmentTask = useCallback(
    async (baseCode: string, prompt: string, model: string): Promise<PreviewTaskResult> => {
      const trimmedPrompt = prompt.trim();
      const requestId = createRequestEntry(trimmedPrompt, model, '正在准备连续调整请求');
      try {
        const result = await callStreamApiForRequest('/api/generate/fix', {
          code: baseCode,
          error: `同一画布会话分支的连续调整指令：\n${trimmedPrompt.slice(0, 9500)}\n\n必须基于传入的完整代码继续修改，保留用户未要求改变的代码、全局参数、节点注释、视觉结果与交互。`,
          language: 'threejs',
          model,
        }, requestId);

        if (!result.code) {
          throw new Error('连续调整接口没有返回代码');
        }

        const taskResult: PreviewTaskResult = {
          code: result.code,
          language: result.language || 'threejs',
          nodes: result.nodes || [],
          edges: result.edges || [],
          refreshKey: Date.now(),
        };
        updateRequestById(requestId, {
          code: taskResult.code,
          message: '连续调整代码已返回，预览已更新',
          status: 'done',
        });
        return taskResult;
      } catch (err) {
        updateRequestById(requestId, {
          message: err instanceof Error ? err.message : '连续调整请求失败',
          status: 'error',
        });
        throw err;
      }
    },
    [callStreamApiForRequest, createRequestEntry, updateRequestById],
  );

  const onVerifierError = useCallback(
    (message: string) => {
      if (phase !== 'verifying') return;
      handleError(message);
    },
    [phase, handleError],
  );

  const onVerifierSuccess = useCallback(() => {
    if (phase !== 'verifying') return;
    handleSuccess();
  }, [phase, handleSuccess]);

  // --- Param editing ---

  const updateNodeParams = useCallback(
    (nodeId: string, key: string, value: unknown) => {
      nodesRef.current = nodesRef.current.map((n) => {
        if (n.id !== nodeId) return n;
        return { ...n, params: { ...n.params, [key]: value } };
      });
      setFinalNodes([...nodesRef.current]);
    },
    [],
  );

  const regenerateFromParams = useCallback(async () => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const originalCode = codeRef.current;
    const language = languageRef.current;

    if (!originalCode || nodes.length === 0) return;

    setPhase('fixing');

    try {
      const prompt = buildGraphDescription({
        nodes,
        edges,
        originalCode,
        language,
      });

      const response = await fetch('/api/generate/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: originalCode,
          error: `请根据以下节点图更新代码参数:\n${prompt}`,
          language,
          model: lastModelRef.current,
        }),
      });

      const result = await response.json();
      if (result.success && result.data?.code) {
        const newCode = result.data.code;
        const apiNodes: NodeData[] = result.data.nodes;
        const apiEdges: EdgeData[] = result.data.edges;
        const nodesFromApi: NodeData[] = (apiNodes && apiNodes.length > 0) ? apiNodes : nodes;
        const edgesFromApi: EdgeData[] = (apiEdges && apiEdges.length > 0) ? apiEdges : edges;
        const { nodes: newNodes, edges: newEdges } = filterConnectedGraph(nodesFromApi, edgesFromApi);
        codeRef.current = newCode;
        nodesRef.current = newNodes;
        edgesRef.current = newEdges;
        setFinalCode(newCode);
        setFinalNodes(newNodes);
        setFinalEdges(newEdges);
        setPreviewKey((k) => k + 1);
        setGenerationKey((k) => k + 1);
        setPhase('success');
        // Compute diff against parent's original snapshot (not edited nodes)
        const parentNodesForParams = activeBaseRef.current
          ? parentNodesSnapshotRef.current
          : [];
        const diffSummaryForParams = activeBaseRef.current
          ? computeNodeDiff(parentNodesForParams, newNodes)
          : undefined;

        // Insert child history under active base (or at top if no base)
        setHistory((prev) => {
          const baseId = activeBaseRef.current;
          const entry: HistoryEntry = {
            id: `hist_${Date.now()}`,
            prompt: `[参数调整] ${lastPromptRef.current.slice(0, 80)}`,
            code: newCode,
            nodes: JSON.parse(JSON.stringify(newNodes)),
            edges: JSON.parse(JSON.stringify(newEdges)),
            language,
            model: lastModelRef.current,
            timestamp: Date.now(),
            parentId: baseId || undefined,
            diffSummary: diffSummaryForParams,
          };
          if (baseId) {
            // 插入到父级记录正下方（作为其第一个子级）
            const baseIdx = prev.findIndex((e) => e.id === baseId);
            if (baseIdx >= 0) {
              const next = [...prev];
              next.splice(baseIdx + 1, 0, entry);
              return next.slice(0, MAX_HISTORY);
            }
          }
          return [entry, ...prev].slice(0, MAX_HISTORY);
        });
      } else {
        console.error('参数更新失败:', result.error);
        setPhase('success');
      }
    } catch (err) {
      console.error('参数更新请求失败:', err);
      setPhase('success');
    }
  }, []);

  // --- Adjust mode ---

  const adjustCode = useCallback(
    async (adjustPrompt: string) => {
      const currentCode = codeRef.current;
      if (!currentCode || !adjustPrompt.trim()) return;

      setPhase('fixing');
      setAdjustExplanation(null);
      resetApiProgress('正在准备调整请求');

      try {
        const result = await callStreamApi('/api/generate/fix', {
          code: currentCode,
          error: `用户要求调整: ${adjustPrompt.trim()}\n请修改代码以满足以上调整要求。`,
          language: languageRef.current,
          model: lastModelRef.current,
        });

        if (result.code) {
          const newCode = result.code;
          const apiNodes: NodeData[] = result.nodes || [];
          const apiEdges: EdgeData[] = result.edges || [];
          const { nodes: newNodes, edges: newEdges } = resolveVisibleGraph(
            apiNodes,
            apiEdges,
            nodesRef.current,
            edgesRef.current,
          );
          codeRef.current = newCode;
          nodesRef.current = newNodes;
          edgesRef.current = newEdges;
          setFinalCode(newCode);
          setFinalNodes(newNodes);
          setFinalEdges(newEdges);
          setPreviewKey((k) => k + 1);
          setGenerationKey((k) => k + 1);
          setPhase('success');
          finishApiProgress('调整代码已返回，预览已更新');
          setAdjustExplanation(`已根据「${adjustPrompt.trim()}」调整代码`);
          // Compute diff against parent if this is a child
          const parentNodesForDiff = activeBaseRef.current
            ? nodesRef.current // pre-adjustment nodes (parent's)
            : [];
          const diffSummary = activeBaseRef.current
            ? computeNodeDiff(parentNodesForDiff, newNodes)
            : undefined;

          // Insert child history under active base (or at top if no base)
          setHistory((prev) => {
            const baseId = activeBaseRef.current;
            const entry: HistoryEntry = {
              id: `hist_${Date.now()}`,
              prompt: `[调整] ${adjustPrompt.trim()}`,
              code: newCode,
              nodes: JSON.parse(JSON.stringify(newNodes)),
              edges: JSON.parse(JSON.stringify(newEdges)),
              language: languageRef.current,
              model: lastModelRef.current,
              timestamp: Date.now(),
              parentId: baseId || undefined,
              diffSummary,
            };
            if (baseId) {
              const baseIdx = prev.findIndex((e) => e.id === baseId);
              if (baseIdx >= 0) {
                const next = [...prev];
                next.splice(baseIdx + 1, 0, entry);
                return next.slice(0, MAX_HISTORY);
              }
            }
            return [entry, ...prev].slice(0, MAX_HISTORY);
          });
        } else {
          console.error('调整失败:', result.error);
          setPhase('success');
          failApiProgress('调整接口没有返回代码');
          setAdjustExplanation(`调整失败: ${result.error || '未知错误'}`);
        }
      } catch (err) {
        console.error('调整请求失败:', err);
        setPhase('success');
        failApiProgress(err instanceof Error ? err.message : '调整请求失败');
        setAdjustExplanation('调整请求发送失败，请检查网络');
      }
    },
    [callStreamApi, failApiProgress, finishApiProgress, resetApiProgress, resolveVisibleGraph],
  );

  // --- Save params locally only (no preview refresh) ---
  const saveNodeParamsOnly = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.length === 0) return;
    setFinalNodes([...nodes]);
    setAdjustExplanation('参数已保存到本地，可继续调整其他节点后统一应用');
  }, []);

  // --- Sync canvas mutations (drag-drop nodes, connect edges) back to refs ---
  const syncFromCanvas = useCallback((nodes: NodeData[], edges: EdgeData[]) => {
    if (nodes.length > 0) {
      hideGeneratedGraphRef.current = false;
    }
    nodesRef.current = nodes;
    edgesRef.current = edges;
    setFinalNodes([...nodes]);
    setFinalEdges([...edges]);
  }, []);

  // --- Edge management (for ParamPanel connections) ---
  const addEdge = useCallback((sourceId: string, targetId: string) => {
    const existing = edgesRef.current.find(
      (e) => e.source === sourceId && e.target === targetId,
    );
    if (existing) return;
    const newEdge: EdgeData = {
      id: `edge_${sourceId}_${targetId}_${Date.now()}`,
      source: sourceId,
      target: targetId,
    };
    edgesRef.current = [...edgesRef.current, newEdge];
    setFinalEdges([...edgesRef.current]);
    setGenerationKey((k) => k + 1);
  }, []);

  const removeEdge = useCallback((sourceId: string, targetId: string) => {
    edgesRef.current = edgesRef.current.filter(
      (e) => !(e.source === sourceId && e.target === targetId),
    );
    setFinalEdges([...edgesRef.current]);
    setGenerationKey((k) => k + 1);
  }, []);

  // --- Generate code purely from node graph (no existing code required) ---
  const generateFromGraph = useCallback(async () => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const currentCode = codeRef.current;
    const language = languageRef.current;

    if (nodes.length === 0) return;

    const graphText = buildGraphDescription({
      nodes,
      edges,
      originalCode: currentCode || '',
      language,
    });

    setPhase('generating');
    setCorrectionLog([]);

    try {
      if (currentCode) {
        // Has existing code → use fix endpoint to update
        const response = await fetch('/api/generate/fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: currentCode,
            error: `请根据以下节点图重新生成完整代码（这是基于节点图的代码重构，请仔细遵循每个节点的参数和连线关系）:\n${graphText}`,
            language,
            model: lastModelRef.current,
          }),
        });

        const result = await response.json();
        if (result.success && result.data?.code) {
          const newCode = result.data.code;
          const apiNodes: NodeData[] = result.data.nodes;
          const apiEdges: EdgeData[] = result.data.edges;
          const nodesFromApi: NodeData[] = (apiNodes && apiNodes.length > 0) ? apiNodes : nodes;
          const edgesFromApi: EdgeData[] = (apiEdges && apiEdges.length > 0) ? apiEdges : edges;
          const { nodes: newNodes, edges: newEdges } = filterConnectedGraph(nodesFromApi, edgesFromApi);
          codeRef.current = newCode;
          nodesRef.current = newNodes;
          edgesRef.current = newEdges;
          setFinalCode(newCode);
          setFinalNodes(newNodes);
          setFinalEdges(newEdges);
          setPreviewKey((k) => k + 1);
          setGenerationKey((k) => k + 1);
          setPhase('success');
          setAdjustExplanation('已根据节点图重新生成代码并预览');

          setHistory((prev) => {
            const entry: HistoryEntry = {
              id: `hist_${Date.now()}`,
              prompt: '[节点图生成] 基于节点结构重新生成代码',
              code: newCode,
              nodes: JSON.parse(JSON.stringify(newNodes)),
              edges: JSON.parse(JSON.stringify(newEdges)),
              language,
              model: lastModelRef.current || 'deepseekv4',
              timestamp: Date.now(),
              parentId: activeBaseRef.current || undefined,
            };
            const baseId = activeBaseRef.current;
            if (baseId) {
              const baseIdx = prev.findIndex((e) => e.id === baseId);
              if (baseIdx >= 0) {
                const next = [...prev];
                next.splice(baseIdx + 1, 0, entry);
                return next.slice(0, MAX_HISTORY);
              }
            }
            return [entry, ...prev].slice(0, MAX_HISTORY);
          });
        } else {
          setPhase('success');
          setAdjustExplanation('代码生成失败，请检查节点配置');
        }
      } else {
        // No existing code → use generate endpoint with graph text as prompt
        lastPromptRef.current = graphText;
        lastModelRef.current = 'deepseekv4';
        attemptRef.current = 1;

        const response = await fetch('/api/generate/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: graphText, model: 'deepseekv4' }),
        });

        const result = await response.json();
        if (result.success && result.data?.code) {
          const code = result.data.code;
          const lang: 'threejs' = result.data.language || 'threejs';
          const nodes: NodeData[] = result.data.nodes || [];
          const edgesData: EdgeData[] = result.data.edges || [];

          languageRef.current = lang;
          const { nodes: filteredNodes, edges: filteredEdges } = filterConnectedGraph(nodes, edgesData);
          nodesRef.current = filteredNodes;
          edgesRef.current = filteredEdges;
          codeRef.current = code;

          setFinalCode(code);
          setFinalNodes(filteredNodes);
          setFinalEdges(filteredEdges);
          setPreviewKey((k) => k + 1);
          setGenerationKey((k) => k + 1);
          setPhase('success');
          setAdjustExplanation('已根据节点图全新生成代码并预览');

          setHistory((prev) => {
            const entry: HistoryEntry = {
              id: `hist_${Date.now()}`,
              prompt: '[节点图生成] 基于节点结构全新生成代码',
              code,
              nodes: JSON.parse(JSON.stringify(filteredNodes)),
              edges: JSON.parse(JSON.stringify(filteredEdges)),
              language: lang,
              model: 'deepseekv4',
              timestamp: Date.now(),
            };
            return [entry, ...prev].slice(0, MAX_HISTORY);
          });
        } else {
          console.error('节点图生成失败:', result.error);
          setPhase('failed');
          setAdjustExplanation('代码生成失败，请检查节点配置');
        }
      }
    } catch (err) {
      console.error('节点图生成请求失败:', err);
      setPhase('success');
      setAdjustExplanation('请求发送失败，请检查网络');
    }
  }, []);

  // --- Code transform: user pastes external code + instruction ---
  const transformCode = useCallback(
    async (sourceCode: string, instruction: string) => {
      if (!sourceCode.trim() || !instruction.trim()) return;

      attemptRef.current = 1;
      lastPromptRef.current = `[代码转化] ${instruction.trim()}`;
      lastModelRef.current = 'deepseekv4';
      hideGeneratedGraphRef.current = false;
      setCorrectionLog([]);
      setAdjustExplanation(null);
      setActiveBaseHistoryId(null);
      activeBaseRef.current = null;
      setPhase('generating');
      setGenerationKey((k) => k + 1);
      resetApiProgress('正在准备代码转化请求');

      try {
        const result = await callStreamApi('/api/generate/fix', {
          code: sourceCode,
            error: `用户要求对以下代码进行转化:\n${instruction.trim()}\n请根据以上指令修改代码，并保留基础节点注释。`,
          language: 'threejs',
          model: lastModelRef.current,
        });

        if (result.code) {
          const code = result.code;
          const apiNodes: NodeData[] = result.nodes || [];
          const apiEdges: EdgeData[] = result.edges || [];
          const nodes: NodeData[] = apiNodes && apiNodes.length > 0 ? apiNodes : nodesRef.current;
          const edges: EdgeData[] = apiEdges && apiEdges.length > 0 ? apiEdges : edgesRef.current;

          languageRef.current = 'threejs';
          const { nodes: filteredNodes, edges: filteredEdges } = filterConnectedGraph(nodes, edges);
          nodesRef.current = filteredNodes;
          edgesRef.current = filteredEdges;

          addLog({
            iteration: 1,
            code,
            error: null,
            phase: 'generating',
          });

          // Show preview immediately
          // 不再进行后台验证 — 验证会导致不必要的自动修复和黑屏
          setFinalCode(code);
          setFinalNodes(filteredNodes);
          setFinalEdges(filteredEdges);
          setPhase('success');
          setPreviewKey((k) => k + 1);
          setGenerationKey((k) => k + 1);
          saveToHistory(`[code transform] ${instruction.trim()}`, 'deepseekv4');
          finishApiProgress('代码转化结果已返回，预览已更新');
        } else {
          console.error('代码转化失败:', result.error);
          setPhase('failed');
          failApiProgress('代码转化接口没有返回代码');
          setAdjustExplanation(`代码转化失败: ${result.error || '未知错误'}`);
        }
      } catch (err) {
        console.error('代码转化请求失败:', err);
        setPhase('failed');
        failApiProgress(err instanceof Error ? err.message : '代码转化请求失败');
        setAdjustExplanation('代码转化请求发送失败，请检查网络');
      }
    },
    [addLog, callStreamApi, failApiProgress, finishApiProgress, resetApiProgress, saveToHistory, startVerify],
  );

  // --- Image to code: user uploads an image + instruction ---
  const imageToCode = useCallback(
    async (imageFile: File, instruction: string, model = 'deepseekv4') => {
      if (!instruction.trim()) return;
      if (isGeneratingRef.current) return;
      isGeneratingRef.current = true;
      hideGeneratedGraphRef.current = true;

      attemptRef.current = 1;
      lastPromptRef.current = `[图生代码] ${instruction.trim()}`;
      lastModelRef.current = model;
      setCorrectionLog([]);
      setAdjustExplanation(null);
      setActiveBaseHistoryId(null);
      activeBaseRef.current = null;
      setPhase('generating');
      setGenerationKey((k) => k + 1);
      resetApiProgress('正在准备图生代码请求');

      try {
        // convert image file to base64 data URL
        const imageDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read image file'));
          reader.readAsDataURL(imageFile);
        });

        const result = await callStreamApi('/api/generate/image-to-code', {
          image: imageDataUrl,
          instruction: instruction.trim(),
          model,
        });

        if (result.code) {
          const code = result.code;
          // 图生代码也不在画布上显示 API 工具节点，与纯文本生成行为一致。
          // 画布只保留用户创建的图像/文本节点和预览节点。
          const nodes: NodeData[] = [];
          const edges: EdgeData[] = [];

          languageRef.current = 'threejs';
          const { nodes: filteredNodes, edges: filteredEdges } = filterConnectedGraph(nodes, edges);
          nodesRef.current = filteredNodes;
          edgesRef.current = filteredEdges;

          addLog({
            iteration: 1,
            code,
            error: null,
            phase: 'generating',
          });

          // Show preview immediately
          // 不再进行后台验证 — 验证会导致不必要的自动修复和黑屏
          setFinalCode(code);
          setFinalNodes(filteredNodes);
          setFinalEdges(filteredEdges);
          setPhase('success');
          setPreviewKey((k) => k + 1);
          setGenerationKey((k) => k + 1);
          saveToHistory(`[image to code] ${instruction.trim()}`, model);
          finishApiProgress('图生代码已返回，预览已更新');
        } else {
          console.error('图生代码失败:', result.error);
          setPhase('failed');
          failApiProgress('图生代码接口没有返回代码');
          setAdjustExplanation(`图生代码失败: ${result.error || '未知错误'}`);
        }
        isGeneratingRef.current = false;
      } catch (err) {
        console.error('图生代码请求失败:', err);
        setPhase('failed');
        failApiProgress(err instanceof Error ? err.message : '图生代码请求失败');
        setAdjustExplanation('图生代码请求发送失败，请检查网络');
        isGeneratingRef.current = false;
      }
    },
    [addLog, callStreamApi, failApiProgress, finishApiProgress, resetApiProgress, saveToHistory, startVerify],
  );

  const refreshPreview = useCallback(() => {
    setPreviewKey((k) => k + 1);
  }, []);

  return {
    phase,
    isProcessing: phase !== 'idle' && phase !== 'success' && phase !== 'failed',
    finalCode,
    finalNodes,
    finalEdges,
    correctionLog,
    verificationCode,
    verificationKey,
    previewKey,
    generationKey,
    adjustExplanation,
    apiProgress,
    streamedCode,
    requestLog,
    history,
    startAutoFix,
    startPreviewTask,
    startPreviewAdjustmentTask,
    onVerifierError,
    onVerifierSuccess,
    updateNodeParams,
    regenerateFromParams,
    saveNodeParamsOnly,
    adjustCode,
    refreshPreview,
    restoreHistory,
    deleteHistory,
    resetProject,
    moveToParent,
    syncFromCanvas,
    addEdge,
    removeEdge,
    generateFromGraph,
    transformCode,
    imageToCode,
    activeBaseHistoryId,
    currentAttempt: attemptRef.current,
    maxAttempts: MAX_ATTEMPTS,
  };
}
