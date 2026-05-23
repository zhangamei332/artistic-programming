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
  language: 'threejs';
  model: string;
  timestamp: number;
  parentId?: string; // 子级记录：指向父级历史记录ID
  diffSummary?: string; // 相对父级的参数差异摘要
}

export type Phase = 'idle' | 'generating' | 'verifying' | 'fixing' | 'success' | 'failed';

const MAX_ATTEMPTS = 3;
const VERIFY_TIMEOUT = 10000;
const MAX_HISTORY = 50;

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

/** Infrastructure nodes are always relevant, even without connections */
const INFRA_NODES = new Set(['scene', 'camera', 'renderer', 'setup', 'draw', 'animation', 'comp_root']);

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
    async (prompt: string, model: string, files: File[] = []) => {
      attemptRef.current = 1;
      lastPromptRef.current = prompt;
      lastModelRef.current = model;
      setCorrectionLog([]);
      setFinalCode(null);
      setFinalNodes(null);
      setFinalEdges([]);
      setAdjustExplanation(null);
      setActiveBaseHistoryId(null);
      activeBaseRef.current = null;
      setPhase('generating');
      setGenerationKey((k) => k + 1);

      try {
        // Build file info for the AI
        const fileNames = files.map((f) => f.name);
        const fileInfo = fileNames.length > 0
          ? `\n已上传文件: ${fileNames.join(', ')}\n请在你的代码注释中使用 @node:file_xxx=文件名 标注文件引用节点，并用 @connect 连接它们到使用该文件的节点。`
          : '';

        const response = await fetch('/api/generate/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: prompt.trim() + fileInfo, model }),
        });

        const result = await response.json();

        if (result.success && result.data?.code) {
          const code = result.data.code;
          const language: 'threejs' =
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
        const apiNodes: NodeData[] = result.data.nodes;
        const apiEdges: EdgeData[] = result.data.edges;
        // 空数组在JS中是truthy的，必须用length检测
        const newNodes: NodeData[] = (apiNodes && apiNodes.length > 0) ? apiNodes : nodes;
        const newEdges: EdgeData[] = (apiEdges && apiEdges.length > 0) ? apiEdges : edges;
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
          const apiNodes: NodeData[] = result.data.nodes;
          const apiEdges: EdgeData[] = result.data.edges;
          const newNodes: NodeData[] = (apiNodes && apiNodes.length > 0) ? apiNodes : nodesRef.current;
          const newEdges: EdgeData[] = (apiEdges && apiEdges.length > 0) ? apiEdges : edgesRef.current;
          codeRef.current = newCode;
          nodesRef.current = newNodes;
          edgesRef.current = newEdges;
          setFinalCode(newCode);
          setFinalNodes(newNodes);
          setFinalEdges(newEdges);
          setPreviewKey((k) => k + 1);
          setGenerationKey((k) => k + 1);
          setPhase('success');
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

  // --- Save params locally only (no preview refresh) ---
  const saveNodeParamsOnly = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.length === 0) return;
    setFinalNodes([...nodes]);
    setAdjustExplanation('参数已保存到本地，可继续调整其他节点后统一应用');
  }, []);

  // --- Sync canvas mutations (drag-drop nodes, connect edges) back to refs ---
  const syncFromCanvas = useCallback((nodes: NodeData[], edges: EdgeData[]) => {
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
          }),
        });

        const result = await response.json();
        if (result.success && result.data?.code) {
          const newCode = result.data.code;
          const apiNodes: NodeData[] = result.data.nodes;
          const apiEdges: EdgeData[] = result.data.edges;
          const newNodes: NodeData[] = (apiNodes && apiNodes.length > 0) ? apiNodes : nodes;
          const newEdges: EdgeData[] = (apiEdges && apiEdges.length > 0) ? apiEdges : edges;
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
              model: lastModelRef.current || 'deepseek',
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
        lastModelRef.current = 'deepseek';
        attemptRef.current = 1;

        const response = await fetch('/api/generate/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: graphText, model: 'deepseek' }),
        });

        const result = await response.json();
        if (result.success && result.data?.code) {
          const code = result.data.code;
          const lang: 'threejs' = result.data.language || 'threejs';
          const nodes: NodeData[] = result.data.nodes || [];
          const edgesData: EdgeData[] = result.data.edges || [];

          languageRef.current = lang;
          const filteredNodes = filterRelevantNodes(nodes, edgesData);
          const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
          const filteredEdges = edgesData.filter(
            (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target),
          );
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
              model: 'deepseek',
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
      lastModelRef.current = 'deepseek';
      setCorrectionLog([]);
      setFinalCode(null);
      setFinalNodes(null);
      setFinalEdges([]);
      setAdjustExplanation(null);
      setActiveBaseHistoryId(null);
      activeBaseRef.current = null;
      setPhase('generating');
      setGenerationKey((k) => k + 1);

      try {
        const response = await fetch('/api/generate/fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: sourceCode,
            error: `用户要求对以下代码进行转化:\n${instruction.trim()}\n请根据以上指令修改代码，保持 @node/@connect 注释标记。`,
            language: 'threejs',
          }),
        });

        const result = await response.json();
        if (result.success && result.data?.code) {
          const code = result.data.code;
          const apiNodes: NodeData[] = result.data.nodes;
          const apiEdges: EdgeData[] = result.data.edges;
          const nodes: NodeData[] = apiNodes && apiNodes.length > 0 ? apiNodes : [];
          const edges: EdgeData[] = apiEdges && apiEdges.length > 0 ? apiEdges : [];

          languageRef.current = 'threejs';
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
          console.error('代码转化失败:', result.error);
          setPhase('failed');
          setAdjustExplanation(`代码转化失败: ${result.error || '未知错误'}`);
        }
      } catch (err) {
        console.error('代码转化请求失败:', err);
        setPhase('failed');
        setAdjustExplanation('代码转化请求发送失败，请检查网络');
      }
    },
    [addLog, startVerify],
  );

  // --- Image to code: user uploads an image + instruction ---
  const imageToCode = useCallback(
    async (imageFile: File, instruction: string) => {
      if (!instruction.trim()) return;

      attemptRef.current = 1;
      lastPromptRef.current = `[图生代码] ${instruction.trim()}`;
      lastModelRef.current = 'deepseek';
      setCorrectionLog([]);
      setFinalCode(null);
      setFinalNodes(null);
      setFinalEdges([]);
      setAdjustExplanation(null);
      setActiveBaseHistoryId(null);
      activeBaseRef.current = null;
      setPhase('generating');
      setGenerationKey((k) => k + 1);

      try {
        // convert image file to base64 data URL
        const imageDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read image file'));
          reader.readAsDataURL(imageFile);
        });

        const response = await fetch('/api/generate/image-to-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imageDataUrl,
            instruction: instruction.trim(),
            model: 'deepseek',
          }),
        });

        const result = await response.json();
        if (result.success && result.data?.code) {
          const code = result.data.code;
          const apiNodes: NodeData[] = result.data.nodes;
          const apiEdges: EdgeData[] = result.data.edges;
          const nodes: NodeData[] = apiNodes && apiNodes.length > 0 ? apiNodes : [];
          const edges: EdgeData[] = apiEdges && apiEdges.length > 0 ? apiEdges : [];

          languageRef.current = 'threejs';
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
          console.error('图生代码失败:', result.error);
          setPhase('failed');
          setAdjustExplanation(`图生代码失败: ${result.error || '未知错误'}`);
        }
      } catch (err) {
        console.error('图生代码请求失败:', err);
        setPhase('failed');
        setAdjustExplanation('图生代码请求发送失败，请检查网络');
      }
    },
    [addLog, startVerify],
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
    saveNodeParamsOnly,
    adjustCode,
    refreshPreview,
    restoreHistory,
    deleteHistory,
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
