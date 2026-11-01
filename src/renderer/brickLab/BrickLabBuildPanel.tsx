/**
 * @file BrickLabBuildPanel.tsx
 * @description brick-lab editor: canvas pose + portals for toolbar / catalog (ED6).
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  BRICK_CATALOG,
  fetchLdrawPart,
  getCachedLdrawMesh,
  getPart,
  readStaging,
  registerPartRuntime,
} from '../../racer/hub/brick/catalog';
import { BRICK_GHOST_OPACITY } from '../../racer/hub/brick/brickCatalog';
import {
  gridMinToWorldCenter,
  rotToYawRad,
  type RotDeg,
} from '../../racer/hub/brick/manual/partFootprint';
import { validateManual, type BrickManual } from '../../racer/hub/brick/manual';
import type { BrickRacerHost } from '../../racer/host/startBrickRacerHost';
import {
  BRICK_LAB_VIEWS,
  brickLabViewLabel,
  setBrickLabLeftMouseMode,
  type BrickLabView,
} from '../../racer/levels/brickLab/brickLabCamera';
import {
  applyMcpCommand,
  createEmptyEditorState,
  editorStateToManual,
  findOpAtCell,
  findTopOpAtStud,
  isValidManualStem,
  manualToEditorState,
  mcpCommandNeedsSceneSync,
  moveEditorBrick,
  placeEditorBrick,
  redoEditor,
  removeEditorBrick,
  rotateEditorBrush,
  rotateSelectedBrick,
  screenToStudHit,
  stackHeightUnder,
  undoEditor,
  validateEditorManual,
  type EditorState,
  type EditorTool,
} from '../../racer/levels/brickLab/editor';

import {
  Focus,
  Hand,
  Layers,
  MousePointer2,
  Paintbrush,
  PanelLeft,
  RectangleVertical,
  Rotate3d,
  RotateCw,
  Square,
  Undo2,
} from 'lucide-react';
import { LegoColorPicker } from '../atelier/LegoColorPicker';
import { CatalogBrowserPanel } from '../catalog/CatalogBrowserPanel';
import '../atelier/atelier.css';

const LI = { size: 16, strokeWidth: 2, 'aria-hidden': true as const };

const VIEW_ICON: Record<BrickLabView, typeof Focus> = {
  orbit: Focus,
  face: RectangleVertical,
  side: PanelLeft,
  top: Square,
};

function chipClass(active: boolean, variant?: 'accent' | 'ghost'): string {
  const parts = ['br-atelier-chip'];
  if (active) parts.push('is-active');
  if (variant === 'accent') parts.push('br-atelier-chip--accent');
  if (variant === 'ghost') parts.push('br-atelier-chip--ghost');
  return parts.join(' ');
}

export type BrickLabBuildHandle = {
  newStructure: () => void;
  saveStructure: () => void;
  loadStructure: () => void;
};

export type BrickLabBuildPanelProps = {
  host: BrickRacerHost | null;
  canvas: HTMLCanvasElement | null;
  toolbarHost: RefObject<HTMLElement | null>;
  catalogHost: RefObject<HTMLElement | null>;
  brickLabView: BrickLabView;
  onSelectBrickLabView: (view: BrickLabView) => void;
  onStats?: (line: string | null) => void;
};

export const BrickLabBuildPanel = forwardRef<BrickLabBuildHandle, BrickLabBuildPanelProps>(
  function BrickLabBuildPanel(props, ref): ReactElement | null {
    const {
      host,
      canvas,
      toolbarHost,
      catalogHost,
      brickLabView,
      onSelectBrickLabView,
      onStats,
    } = props;
    const [state, setState] = useState<EditorState>(() =>
      createEmptyEditorState('untitled', 'Nouvelle structure')
    );
    const [msg, setMsg] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [loadOpen, setLoadOpen] = useState(false);
    const [loadStems, setLoadStems] = useState<string[]>([]);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [saveOpen, setSaveOpen] = useState(false);
    const [saveStem, setSaveStem] = useState('');
    const [saveErr, setSaveErr] = useState<string | null>(null);
    const [hostsReady, setHostsReady] = useState(0);
    const stateRef = useRef(state);
    stateRef.current = state;
    const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dragOpIdRef = useRef<string | null>(null);
    const dragMovedRef = useRef(false);
    /** LDraw ids already requested for brush ghost (one fetch per part). */
    const ghostFetchRef = useRef<Set<string>>(new Set());

    useEffect(() => {
      setHostsReady((n) => n + 1);
    }, [toolbarHost, catalogHost]);

    /** CF2 — reload BC1 staging into runtime catalog on brick-lab mount. */
    useEffect(() => {
      for (const part of readStaging()) {
        registerPartRuntime(part);
      }
    }, []);

    const onStatsRef = useRef(onStats);
    onStatsRef.current = onStats;

    const syncScene = useCallback(
      (next: EditorState) => {
        if (!host) return;
        if (syncTimer.current) clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(() => {
          const manual = editorStateToManual(next);
          setBusy(true);
          void host
            .syncBrickLabManual(manual, false)
            .then((stats) => {
              // null = coalesced into an in-flight sync; that call finishes busy/stats.
              if (stats == null) return;
              onStatsRef.current?.(stats);
              setBusy(false);
            })
            .catch((err) => {
              setMsg(err instanceof Error ? err.message : String(err));
              setBusy(false);
            });
        }, 80);
      },
      [host]
    );

    const commit = useCallback(
      (mutate: (s: EditorState) => void) => {
        setState((prev) => {
          const next = {
            ...prev,
            ops: [...prev.ops],
            undo: [...prev.undo],
            redo: [...prev.redo],
          };
          mutate(next);
          syncScene(next);
          return { ...next, ops: [...next.ops] };
        });
      },
      [syncScene]
    );
    const commitRef = useRef(commit);
    commitRef.current = commit;

    const onNew = useCallback((): void => {
      const next = createEmptyEditorState('untitled', 'Nouvelle structure');
      setState(next);
      syncScene(next);
      setMsg('Nouvelle structure');
    }, [syncScene]);

    const writeStructure = useCallback(async (stemRaw: string): Promise<boolean> => {
      const stem = stemRaw.trim().toLowerCase();
      if (!isValidManualStem(stem) || stem === 'untitled') {
        setSaveErr('Nom invalide ([a-z0-9-]+, pas untitled)');
        setMsg('Nom invalide ([a-z0-9-]+)');
        return false;
      }
      const nextState = { ...stateRef.current, stem };
      const issues = validateEditorManual(nextState);
      if (issues.length) {
        setSaveErr(issues[0]!);
        setMsg(issues[0]!);
        return false;
      }
      const write = window.brickRacer?.writeBrickManual;
      if (!write) {
        const err = 'IPC writeBrickManual indisponible (Electron)';
        setSaveErr(err);
        setMsg(err);
        return false;
      }
      const manual = editorStateToManual(nextState);
      const res = await write(stem, manual);
      if (!res.ok) {
        setSaveErr(res.error ?? 'échec');
        setMsg(res.error ?? 'échec');
        return false;
      }
      stateRef.current = nextState;
      setState(nextState);
      setSaveOpen(false);
      setSaveErr(null);
      setMsg(`Structure sauvée · ${stem}.manual.json`);
      return true;
    }, []);

    const onSave = useCallback(async (): Promise<void> => {
      const current = stateRef.current;
      const stem = current.stem.trim();
      if (!isValidManualStem(stem) || stem === 'untitled') {
        setSaveStem('');
        setSaveErr(null);
        setSaveOpen(true);
        return;
      }
      await writeStructure(stem);
    }, [writeStructure]);

    const onLoadMenu = useCallback(async (): Promise<void> => {
      const list = window.brickRacer?.listBrickManuals;
      if (!list) {
        setMsg('IPC listBrickManuals indisponible (Electron)');
        return;
      }
      setLoadErr(null);
      const res = await list();
      if (!res.ok) {
        setLoadErr(res.error);
        setLoadStems([]);
      } else {
        setLoadStems(res.stems);
      }
      setLoadOpen(true);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        newStructure: onNew,
        saveStructure: () => {
          void onSave();
        },
        loadStructure: () => {
          void onLoadMenu();
        },
      }),
      [onNew, onSave, onLoadMenu]
    );

    const onLoadStem = async (stem: string): Promise<void> => {
      const read = window.brickRacer?.readBrickManual;
      if (!read) {
        setMsg('IPC readBrickManual indisponible (Electron)');
        return;
      }
      const res = await read(stem);
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      const checked = validateManual(res.manual);
      if (!checked.ok) {
        setMsg(
          checked.issues[0]
            ? `${checked.issues[0].path}: ${checked.issues[0].message}`
            : 'manuel invalide'
        );
        return;
      }
      const next = manualToEditorState(checked.manual as BrickManual, stem);
      setState(next);
      syncScene(next);
      setLoadOpen(false);
      setMsg(`Structure chargée · ${stem}`);
    };

    const setTool = (tool: EditorTool): void => {
      setState((s) => ({
        ...s,
        tool,
        selectedOpId: tool === 'select' ? s.selectedOpId : null,
      }));
      dragOpIdRef.current = null;
      const label =
        tool === 'brush'
          ? 'Mode pinceau'
          : tool === 'select'
            ? 'Mode sélection'
            : tool === 'orbit'
              ? 'Mode orbite'
              : 'Mode pan';
      setMsg(label);
    };

    useEffect(() => {
      if (!host) return;
      const mode =
        state.tool === 'orbit' ? 'rotate' : state.tool === 'pan' ? 'pan' : null;
      setBrickLabLeftMouseMode(host.engine, mode);
    }, [host, state.tool]);

    /** LT4 — MCP bus → editorState → scene. */
    useEffect(() => {
      const subscribe = window.brickRacer?.onBrickLabMcpCommand;
      if (!subscribe) return;
      return subscribe(async (cmd) => {
        const working: EditorState = {
          ...stateRef.current,
          ops: stateRef.current.ops,
          undo: stateRef.current.undo,
          redo: stateRef.current.redo,
        };
        const type =
          cmd && typeof cmd === 'object' && 'type' in cmd
            ? String((cmd as { type: unknown }).type)
            : '';
        const dryRun =
          cmd && typeof cmd === 'object' && 'dryRun' in cmd
            ? Boolean((cmd as { dryRun?: boolean }).dryRun)
            : false;
        const result = await applyMcpCommand(cmd, {
          levelId: 'brick-lab',
          state: working,
          writeManual: async (stem, manual) => {
            const write = window.brickRacer?.writeBrickManual;
            if (!write) return { ok: false, error: 'writeBrickManual indisponible' };
            return write(stem, manual);
          },
          readManual: async (stem) => {
            const read = window.brickRacer?.readBrickManual;
            if (!read) return { ok: false, error: 'readBrickManual indisponible' };
            const res = await read(stem);
            if (!res.ok) return { ok: false, error: res.error };
            return { ok: true, stem: res.stem, manual: res.manual };
          },
          setView: (view) => {
            onSelectBrickLabView(view);
          },
          mergeBc1Parts: async (staging) => {
            const merge = window.brickRacer?.mergeBc1Parts;
            if (!merge) return { ok: false, error: 'mergeBc1Parts indisponible' };
            return merge(staging);
          },
        });
        stateRef.current = working;
        setState({
          ...working,
          ops: [...working.ops],
          undo: [...working.undo],
          redo: [...working.redo],
        });
        if (result.ok && mcpCommandNeedsSceneSync(type) && !dryRun) {
          syncScene(working);
        }
        const placedN = (result as { placed?: unknown[] }).placed?.length;
        if (
          result.ok &&
          (type === 'place_bricks' ||
            type === 'place_assembly' ||
            type === 'fill_rect' ||
            type === 'wall' ||
            type === 'ring' ||
            type === 'disc' ||
            type === 'column')
        ) {
          setMsg(
            dryRun
              ? `MCP · dryRun · ${String(placedN ?? (result as { placedCount?: number }).placedCount ?? 0)} ok`
              : `MCP · ${type} · ${String(placedN ?? (result as { placedCount?: number }).placedCount ?? 0)} briques`
          );
        } else if (
          result.ok &&
          (type === 'new' ||
            type === 'load' ||
            type === 'save' ||
            type === 'set_view' ||
            type === 'promote_parts' ||
            type === 'promote_bom' ||
            type === 'promote_status')
        ) {
          const reg = (result as { registered?: string[] }).registered;
          setMsg(
            type.startsWith('promote')
              ? `MCP · ${type} · +${String(reg?.length ?? 0)} pièces`
              : `MCP · ${type} · ${working.stem}`
          );
        } else if (!result.ok && result.error) {
          setMsg(`MCP · ${result.error}`);
        }
        return result;
      });
    }, [syncScene, onSelectBrickLabView]);

    useEffect(() => {
      if (!canvas || !host) return;

      const previewGhost = (
        partId: string,
        colorId: string,
        rot: RotDeg,
        sx: number,
        py: number,
        sz: number,
        opacity?: number
      ): void => {
        const part = BRICK_CATALOG.parts.find((p) => p.id === partId);
        if (!part) return;
        const position = gridMinToWorldCenter([0, 0, 0], sx, py, sz, partId, rot);
        const yaw = rotToYawRad(rot);
        const ldrawId = part.ldrawId ?? part.id;
        const look = {
          colorId,
          position,
          yaw,
          partId,
          ...(opacity != null ? { opacity } : {}),
        };
        if (getCachedLdrawMesh(ldrawId)) {
          const mesh = host.previewCatalogMesh({
            key: ldrawId,
            ...look,
          });
          if (mesh.triangleCount > 0) return;
        }
        host.previewCatalogPart({
          footprint: part.footprint,
          ...look,
        });
        if (!ghostFetchRef.current.has(ldrawId)) {
          ghostFetchRef.current.add(ldrawId);
          void fetchLdrawPart(ldrawId, 'ground-center').then((res) => {
            if (!res?.ok) return;
            host.previewCatalogMesh({
              key: ldrawId,
              ...res.source,
              ...look,
            });
          });
        }
      };

      const onMove = (e: PointerEvent): void => {
        const s = stateRef.current;
        if (s.tool === 'orbit' || s.tool === 'pan') {
          host.clearCatalogPreview();
          return;
        }
        const dragId = dragOpIdRef.current;

        if (s.tool === 'select' && dragId && (e.buttons & 1) === 1) {
          const op = s.ops.find((o) => o.id === dragId);
          if (!op) return;
          const rot = (op.rot ?? 0) as 0 | 90 | 180 | 270;
          const planePy = s.autoStack ? op.at[1] : s.layerPy;
          const hit = screenToStudHit(
            host.engine,
            canvas,
            e.clientX,
            e.clientY,
            planePy,
            op.part,
            rot
          );
          if (!hit) return;
          const others = s.ops.filter((o) => o.id !== dragId);
          const py = s.autoStack
            ? stackHeightUnder(others, op.part, hit.sx, hit.sz, rot)
            : s.layerPy;
          previewGhost(op.part, op.color, rot, hit.sx, py, hit.sz);
          if (hit.sx !== op.at[0] || py !== op.at[1] || hit.sz !== op.at[2]) {
            const firstStep = !dragMovedRef.current;
            dragMovedRef.current = true;
            commitRef.current((st) => {
              moveEditorBrick(st, dragId, hit.sx, py, hit.sz, firstStep);
            });
          }
          return;
        }

        if (s.tool === 'select') {
          const selected = s.selectedOpId
            ? s.ops.find((o) => o.id === s.selectedOpId)
            : null;
          if (selected) {
            const rot = (selected.rot ?? 0) as 0 | 90 | 180 | 270;
            previewGhost(
              selected.part,
              selected.color,
              rot,
              selected.at[0],
              selected.at[1],
              selected.at[2]
            );
          } else {
            host.clearCatalogPreview();
          }
          return;
        }

        const planePy = s.autoStack ? Math.max(0, s.layerPy) : s.layerPy;
        const hit = screenToStudHit(
          host.engine,
          canvas,
          e.clientX,
          e.clientY,
          planePy,
          s.partId,
          s.rot
        );
        if (!hit) {
          host.clearCatalogPreview();
          return;
        }
        const py = s.autoStack
          ? stackHeightUnder(s.ops, s.partId, hit.sx, hit.sz, s.rot)
          : s.layerPy;
        previewGhost(s.partId, s.colorId, s.rot, hit.sx, py, hit.sz, BRICK_GHOST_OPACITY);
      };

      const onDown = (e: PointerEvent): void => {
        const s = stateRef.current;
        if (s.tool === 'orbit' || s.tool === 'pan') return;
        if (e.button !== 0 && e.button !== 2) return;
        e.preventDefault();
        const probePy = s.autoStack ? 0 : s.layerPy;
        const hit = screenToStudHit(
          host.engine,
          canvas,
          e.clientX,
          e.clientY,
          probePy,
          s.partId,
          s.rot
        );
        if (!hit) return;

        if (s.tool === 'select') {
          if (e.button === 2) {
            const under = findTopOpAtStud(s.ops, hit.sx, hit.sz);
            if (under && under.id === s.selectedOpId) {
              commitRef.current((st) => {
                removeEditorBrick(st, under.id);
              });
            } else {
              setState((st) => ({ ...st, selectedOpId: null }));
              host.clearCatalogPreview();
            }
            return;
          }
          const under = findTopOpAtStud(s.ops, hit.sx, hit.sz);
          dragOpIdRef.current = under?.id ?? null;
          dragMovedRef.current = false;
          setState((st) => ({ ...st, selectedOpId: under?.id ?? null }));
          if (under) {
            setMsg(`Sélection · ${under.part}`);
          }
          return;
        }

        if (e.button === 2) {
          const py = s.autoStack
            ? Math.max(0, stackHeightUnder(s.ops, s.partId, hit.sx, hit.sz, s.rot) - 1)
            : s.layerPy;
          const under = findOpAtCell(s.ops, hit.sx, py, hit.sz);
          if (under) {
            commitRef.current((st) => {
              removeEditorBrick(st, under.id);
            });
          }
          return;
        }
        if (e.altKey) {
          const under = findTopOpAtStud(s.ops, hit.sx, hit.sz);
          if (under) {
            setState((st) => ({
              ...st,
              partId: under.part,
              colorId: under.color,
              rot: under.rot ?? 0,
            }));
          }
          return;
        }
        const py = s.autoStack
          ? stackHeightUnder(s.ops, s.partId, hit.sx, hit.sz, s.rot)
          : s.layerPy;
        commitRef.current((st) => {
          const placed = placeEditorBrick(st, hit.sx, py, hit.sz);
          if (!placed) setMsg('Emplacement occupé');
        });
      };

      const onUp = (): void => {
        dragOpIdRef.current = null;
        dragMovedRef.current = false;
      };

      const onKey = (e: KeyboardEvent): void => {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.key === 'v' || e.key === 'V') {
          setTool('select');
          return;
        }
        if (e.key === 'b' || e.key === 'B') {
          setTool('brush');
          return;
        }
        if (e.key === 'c' || e.key === 'C') {
          setTool('orbit');
          return;
        }
        if (e.key === 'h' || e.key === 'H') {
          setTool('pan');
          return;
        }
        if (e.key === 'r' || e.key === 'R') {
          const s = stateRef.current;
          if (s.tool === 'orbit' || s.tool === 'pan') return;
          if (s.tool === 'select' && s.selectedOpId) {
            commitRef.current((st) => {
              rotateSelectedBrick(st);
            });
          } else {
            commitRef.current((st) => {
              rotateEditorBrush(st);
            });
          }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          const s = stateRef.current;
          if (s.tool === 'select' && s.selectedOpId) {
            e.preventDefault();
            const id = s.selectedOpId;
            commitRef.current((st) => {
              removeEditorBrick(st, id);
            });
          }
        } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
          e.preventDefault();
          commitRef.current((st) => {
            undoEditor(st);
          });
        } else if (
          (e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
          (e.key === 'z' && e.shiftKey && (e.ctrlKey || e.metaKey))
        ) {
          e.preventDefault();
          commitRef.current((st) => {
            redoEditor(st);
          });
        } else if (e.key === 'PageUp') {
          commitRef.current((st) => {
            st.autoStack = false;
            st.layerPy = Math.max(0, st.layerPy + (e.shiftKey ? 3 : 1));
          });
        } else if (e.key === 'PageDown') {
          commitRef.current((st) => {
            st.autoStack = false;
            st.layerPy = Math.max(0, st.layerPy - (e.shiftKey ? 3 : 1));
          });
        }
      };

      const onContext = (e: Event): void => {
        if (stateRef.current.tool === 'orbit' || stateRef.current.tool === 'pan') return;
        e.preventDefault();
      };

      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      canvas.addEventListener('contextmenu', onContext);
      window.addEventListener('keydown', onKey);
      return () => {
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('contextmenu', onContext);
        window.removeEventListener('keydown', onKey);
        setBrickLabLeftMouseMode(host.engine, null);
      };
    }, [canvas, host]);

    void hostsReady;
    const toolbarEl = toolbarHost.current;
    const catalogEl = catalogHost.current;

    const toolbar = (
      <div className="br-brick-toolbar" role="toolbar" aria-label="Outils brick-lab">
        <div className="br-atelier-chips" role="group" aria-label="Mode">
          <button
            type="button"
            className={chipClass(state.tool === 'select')}
            title="Sélection / déplacement (V)"
            onClick={() => setTool('select')}
          >
            <MousePointer2 {...LI} /> Sélection
          </button>
          <button
            type="button"
            className={chipClass(state.tool === 'brush')}
            title="Pinceau (B)"
            onClick={() => setTool('brush')}
          >
            <Paintbrush {...LI} /> Pinceau
          </button>
          <button
            type="button"
            className={chipClass(state.tool === 'orbit')}
            title="Orbite caméra (C)"
            onClick={() => setTool('orbit')}
          >
            <Rotate3d {...LI} /> Orbite
          </button>
          <button
            type="button"
            className={chipClass(state.tool === 'pan')}
            title="Pan caméra (H)"
            onClick={() => setTool('pan')}
          >
            <Hand {...LI} /> Pan
          </button>
        </div>
        <span className="br-brick-toolbar__sep" aria-hidden="true" />
        <div className="br-atelier-chips" role="group" aria-label="Vue">
          {BRICK_LAB_VIEWS.map((view) => {
            const Icon = VIEW_ICON[view];
            return (
              <button
                key={view}
                type="button"
                className={chipClass(view === brickLabView)}
                disabled={view === brickLabView}
                onClick={() => onSelectBrickLabView(view)}
              >
                <Icon {...LI} /> {brickLabViewLabel(view)}
              </button>
            );
          })}
        </div>
        <span className="br-brick-toolbar__sep" aria-hidden="true" />
        {state.tool === 'brush' ? (
          <button
            type="button"
            className={chipClass(state.autoStack)}
            onClick={() => setState((s) => ({ ...s, autoStack: !s.autoStack }))}
          >
            <Layers {...LI} /> Empile
          </button>
        ) : null}
        <button
          type="button"
          className={chipClass(false)}
          onClick={() =>
            commit((st) => {
              if (st.tool === 'select' && st.selectedOpId) rotateSelectedBrick(st);
              else rotateEditorBrush(st);
            })
          }
        >
          <RotateCw {...LI} />{' '}
          {state.tool === 'select' && state.selectedOpId
            ? ((state.ops.find((o) => o.id === state.selectedOpId)?.rot ?? 0) as number)
            : state.rot}
          °
        </button>
        <button
          type="button"
          className={chipClass(false, 'ghost')}
          onClick={() =>
            commit((st) => {
              undoEditor(st);
            })
          }
        >
          <Undo2 {...LI} /> Annuler
        </button>
        <span className="br-brick-toolbar__meta">
          {state.tool === 'select'
            ? state.selectedOpId
              ? `sel ${state.ops.find((o) => o.id === state.selectedOpId)?.part ?? '?'}`
              : 'aucune sélection'
            : state.tool === 'orbit'
              ? 'orbite'
              : state.tool === 'pan'
                ? 'pan'
                : `${state.autoStack ? 'auto' : `${state.layerPy}P`} · ${state.partId}`}
          {' · '}
          {state.ops.length}
        </span>
        {state.tool === 'brush' ? (
          <LegoColorPicker
            value={state.colorId}
            allowedMaterials={getPart(state.partId)?.allowedMaterials}
            onChange={(id) => setState((s) => ({ ...s, colorId: id }))}
          />
        ) : null}
        {msg ? <span className="br-brick-toolbar__msg">{msg}</span> : null}
        {busy ? <span className="br-brick-toolbar__msg">Sync…</span> : null}
      </div>
    );

    const catalog = (
      <div className="br-brick-catalog">
        <header className="br-brick-catalog__head">
          <h2 className="br-atelier-drawer__title">Catalogue</h2>
          <p className="br-atelier-meta">
            pinceau <b>{state.partId}</b>
          </p>
        </header>
        <CatalogBrowserPanel
          host={host}
          embedded
          pickerMode
          onUsePart={(part) => {
            registerPartRuntime({
              id: part.id,
              name: part.name,
              category: part.category,
              footprint: part.footprint,
              mesh: { status: 'box' },
              ...(part.ldrawId ? { ldrawId: part.ldrawId } : {}),
            });
            setState((s) => ({
              ...s,
              tool: 'brush',
              partId: part.id,
              selectedOpId: null,
            }));
            setMsg(`Pinceau · ${part.id}`);
          }}
        />
      </div>
    );

    const loadDialog = loadOpen ? (
      <div className="br-build__dialog br-build__dialog--overlay" role="dialog" aria-modal="true">
        <div className="br-build__dialog-card">
          <p className="br-atelier-label">Charger la structure</p>
          {loadErr ? <p className="br-catalog__error">{loadErr}</p> : null}
          {loadStems.length === 0 && !loadErr ? (
            <p className="br-atelier-empty">Aucun fichier .manual.json</p>
          ) : (
            <ul className="br-build__dialog-list">
              {loadStems.map((stem) => (
                <li key={stem}>
                  <button
                    type="button"
                    className="br-build__dialog-item"
                    onClick={() => void onLoadStem(stem)}
                  >
                    {stem}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className={chipClass(false, 'ghost')} onClick={() => setLoadOpen(false)}>
            Fermer
          </button>
        </div>
      </div>
    ) : null;

    const saveDialog = saveOpen ? (
      <div className="br-build__dialog br-build__dialog--overlay" role="dialog" aria-modal="true">
        <div className="br-build__dialog-card">
          <p className="br-atelier-label">Enregistrer la structure</p>
          <label className="br-atelier-field">
            <span className="br-atelier-label">Nom (a-z, 0-9, -)</span>
            <input
              className="br-atelier-input"
              type="text"
              autoFocus
              value={saveStem}
              placeholder="ma-structure"
              spellCheck={false}
              onChange={(e) => {
                setSaveStem(e.target.value);
                setSaveErr(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void writeStructure(saveStem);
                }
                if (e.key === 'Escape') setSaveOpen(false);
              }}
            />
          </label>
          {saveErr ? <p className="br-catalog__error">{saveErr}</p> : null}
          <div className="br-build__dialog-actions">
            <button
              type="button"
              className={chipClass(true, 'accent')}
              onClick={() => void writeStructure(saveStem)}
            >
              Sauver
            </button>
            <button
              type="button"
              className={chipClass(false, 'ghost')}
              onClick={() => {
                setSaveOpen(false);
                setSaveErr(null);
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    ) : null;

    return (
      <>
        {toolbarEl ? createPortal(toolbar, toolbarEl) : null}
        {catalogEl ? createPortal(catalog, catalogEl) : null}
        {loadDialog ? createPortal(loadDialog, document.body) : null}
        {saveDialog ? createPortal(saveDialog, document.body) : null}
      </>
    );
  }
);
