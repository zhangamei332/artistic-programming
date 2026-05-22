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

export interface HistoryEntry {
  id: string;
  prompt: string;
  code: string;
  nodes: NodeData[];
  edges: EdgeData[];
  language: 'threejs' | 'p5js';
  model: string;
  timestamp: number;
}

export type Phase = 'idle' | 'generating' | 'verifying' | 'fixing' | 'success' | 'failed';

const MAX_ATTEMPTS = 3;
const VERIFY_TIMEOUT = 10000;
const MAX_HISTORY = 50;

/** Infrastructure nodes are always relevant, even without connections */
const INFRA_NODES = new Set(['scene', 'camera', 'renderer', 'setup', 'draw', 'animation']);

/** Filter out nodes that have no connections AND no editable parameters (not infrastructure) */
function filterRelevantNodes(nodes: NodeData[], edges: EdgeData[]): NodeData[] {
  const connectedIds = new Set<string>();
  for (const e of edges) {
    connectedIds.add(e.source);
    connectedIds.add(e.target);
  }
  return nodes.filter((n) => {
    if (INFRA_NODES.has(n.type)) return true;
    if (connectedIds.has(n.id)) return true;
    const paramKeys = Object.keys(n.params).filter((k) => k !== 'interaction');
    if (paramKeys.length > 0) return true;
    return false;
  });
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
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const attemptRef = useRef(1);
  const languageRef = useRef<'threejs' | 'p5js'>('threejs');
  const nodesRef = useRef<NodeData[]>([]);
  const edgesRef = useRef<EdgeData[]>([]);
  const codeRef = useRef<string>('');
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPromptRef = useRef<string>('');
  const lastModelRef = useRef<string>('deepseek');

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
    codeRef.current = entry.code;
    languageRef.current = entry.language;
    nodesRef.current = JSON.parse(JSON.stringify(entry.nodes));
    edgesRef.current = JSON.parse(JSON.stringify(entry.edges));

    setFinalCode(entry.code);
    setFinalNodes(entry.nodes);
    setFinalEdges(entry.edges);
    setPhase('success');
    setPreviewKey((k) => k + 1);
    setGenerationKey((k) => k + 1);
    setCorrectionLog([]);
    setAdjustExplanation(`已恢复历史记录: ${entry.prompt.slice(0, 50)}...`);
  }, []);

  const deleteHistory = useCallback((id: string) => {
    setHistory((prev) => prev.filter((e) => e.id !== id));
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
        const response = await fetch('/api/generate/fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            error,
            language: languageRef.current,
          }),
        });

        const result = await response.json();
        if (result.success && result.data?.code) {
          const fixedCode = result.data.code;
          addLog({
            iteration: attemptRef.current,
            code: fixedCode,
            error: null,
            phase: 'fixing',
          });
          startVerify(fixedCode);
        } else {
          setPhase('failed');
        }
      } catch (err) {
        console.error('修复请求失败:', err);
        setPhase('failed');
      }
    },
    [addLog, startVerify],
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

    setPhase('success');
    setFinalCode(codeRef.current);
    setFinalNodes(nodesRef.current);
    setFinalEdges(edgesRef.current);
    setVerificationCode(null);

    // Save to history
    saveToHistory(lastPromptRef.current, lastModelRef.current);
  }, [addLog, clearVerifyTimer, saveToHistory]);

  const startAutoFix = useCallback(
    async (prompt: string, model: string) => {
      attemptRef.current = 1;
      lastPromptRef.current = prompt;
      lastModelRef.current = model;
      setCorrectionLog([]);
      setFinalCode(null);
      setFinalNodes(null);
      setFinalEdges([]);
      setAdjustExplanation(null);
      setPhase('generating');
      setGenerationKey((k) => k + 1);

      try {
        const response = await fetch('/api/generate/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: prompt.trim(), model }),
        });

        const result = await response.json();

        if (result.success && result.data?.code) {
          const code = result.data.code;
          const language: 'threejs' | 'p5js' =
            result.data.language || 'threejs';
          const nodes: NodeData[] = result.data.nodes || [];
          const edges: EdgeData[] = result.data.edges || [];

          languageRef.current = language;
          const filteredNodes = filterRelevantNodes(nodes, edges);
          const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
          const filteredEdges = edges.filter(
            (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target),
          );
          nodesRef.current = filteredNodes;
          edgesRef.current = filteredEdges;

          addLog({
            iteration: 1,
            code,
            error: null,
            phase: 'generating',
          });

          startVerify(code);
        } else {
          console.error('生成失败:', result.error);
          setPhase('failed');
        }
      } catch (err) {
        console.error('请求失败:', err);
        setPhase('failed');
      }
    },
    [addLog, startVerify],
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
        }),
      });

      const result = await response.json();
      if (result.success && result.data?.code) {
        const newCode = result.data.code;
        codeRef.current = newCode;
        setFinalCode(newCode);
        setPreviewKey((k) => k + 1);
        setPhase('success');
        // Save to history so the updated version is recorded
        setHistory((prev) => {
          const entry: HistoryEntry = {
            id: `hist_${Date.now()}`,
            prompt: `[参数调整] ${lastPromptRef.current.slice(0, 80)}`,
            code: newCode,
            nodes: JSON.parse(JSON.stringify(nodes)),
            edges: JSON.parse(JSON.stringify(edges)),
            language,
            model: lastModelRef.current,
            timestamp: Date.now(),
          };
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

      try {
        const response = await fetch('/api/generate/fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: currentCode,
            error: `用户要求调整: ${adjustPrompt.trim()}\n请修改代码以满足以上调整要求，保持代码结构不变，仅修改相关部分。`,
            language: languageRef.current,
          }),
        });

        const result = await response.json();
        if (result.success && result.data?.code) {
          const newCode = result.data.code;
          codeRef.current = newCode;
          setFinalCode(newCode);
          setPreviewKey((k) => k + 1);
          setPhase('success');
          setAdjustExplanation(`已根据「${adjustPrompt.trim()}」调整代码`);
          // Save adjustment to history
          setHistory((prev) => {
            const entry: HistoryEntry = {
              id: `hist_${Date.now()}`,
              prompt: `[调整] ${adjustPrompt.trim()}`,
              code: newCode,
              nodes: JSON.parse(JSON.stringify(nodesRef.current)),
              edges: JSON.parse(JSON.stringify(edgesRef.current)),
              language: languageRef.current,
              model: lastModelRef.current,
              timestamp: Date.now(),
            };
            return [entry, ...prev].slice(0, MAX_HISTORY);
          });
        } else {
          console.error('调整失败:', result.error);
          setPhase('success');
          setAdjustExplanation(`调整失败: ${result.error || '未知错误'}`);
        }
      } catch (err) {
        console.error('调整请求失败:', err);
        setPhase('success');
        setAdjustExplanation('调整请求发送失败，请检查网络');
      }
    },
    [],
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
    history,
    startAutoFix,
    onVerifierError,
    onVerifierSuccess,
    updateNodeParams,
    regenerateFromParams,
    adjustCode,
    refreshPreview,
    restoreHistory,
    deleteHistory,
    currentAttempt: attemptRef.current,
    maxAttempts: MAX_ATTEMPTS,
  };
}
