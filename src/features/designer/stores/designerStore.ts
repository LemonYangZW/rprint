/**
 * Designer Store - 设计器状态管理
 *
 * 使用 Zustand 管理设计器的所有状态，包括：
 * - 画布配置
 * - 元素列表
 * - 选中状态
 * - 历史记录（撤销/重做）
 */

import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { CanvasElement, CanvasConfig, HistoryState } from "../types";

// ============================================
// Store 类型定义
// ============================================

interface DesignerState {
  // 画布配置
  config: CanvasConfig;

  // 元素列表
  elements: CanvasElement[];

  // 选中的元素 ID
  selectedIds: string[];

  // 历史记录
  history: HistoryState;

  // 是否有未保存的更改
  isDirty: boolean;
}

interface DesignerActions {
  // 元素操作
  addElement: (element: Omit<CanvasElement, "id">) => string;
  updateElement: (id: string, changes: Partial<CanvasElement>) => void;
  updateElements: (updates: Array<{ id: string; changes: Partial<CanvasElement> }>) => void;
  removeElement: (id: string) => void;
  removeElements: (ids: string[]) => void;
  duplicateElements: (ids: string[]) => string[];

  // 选择操作
  setSelection: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // 层级操作
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;

  // 对齐操作
  alignElements: (ids: string[], alignment: "left" | "center" | "right" | "top" | "middle" | "bottom") => void;
  distributeElements: (ids: string[], direction: "horizontal" | "vertical") => void;

  // 画布配置
  updateConfig: (changes: Partial<CanvasConfig>) => void;
  setScale: (scale: number) => void;
  toggleGrid: () => void;
  toggleRulers: () => void;
  toggleSnap: () => void;

  // 历史记录
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  clearHistory: () => void;

  // 文档操作
  reset: () => void;
  loadElements: (elements: CanvasElement[]) => void;
  setDirty: (dirty: boolean) => void;
}

type DesignerStore = DesignerState & { actions: DesignerActions };

// ============================================
// 默认值
// ============================================

const defaultConfig: CanvasConfig = {
  kind: "pdf",
  width: 210,
  height: 297,
  unit: "mm",
  scale: 1,
  gridSize: 5,
  showGrid: true,
  showRulers: true,
  snapEnabled: true,
  snapToGrid: true,
  snapToGuides: true,
  snapToElements: true,
};

const initialState: DesignerState = {
  config: defaultConfig,
  elements: [],
  selectedIds: [],
  history: { past: [], future: [] },
  isDirty: false,
};

// ============================================
// Store 创建
// ============================================

export const useDesignerStore = create<DesignerStore>((set, get) => ({
  ...initialState,

  actions: {
    // ----------------------------------------
    // 元素操作
    // ----------------------------------------

    addElement: (element) => {
      const id = uuidv4();
      const newElement: CanvasElement = {
        ...element,
        id,
        z: get().elements.length,
      };

      set((state) => ({
        elements: [...state.elements, newElement],
        selectedIds: [id],
        isDirty: true,
      }));

      get().actions.saveToHistory();
      return id;
    },

    updateElement: (id, changes) => {
      set((state) => ({
        elements: state.elements.map((el) =>
          el.id === id ? { ...el, ...changes } : el
        ),
        isDirty: true,
      }));
    },

    updateElements: (updates) => {
      set((state) => {
        const updateMap = new Map(updates.map((u) => [u.id, u.changes]));
        return {
          elements: state.elements.map((el) => {
            const changes = updateMap.get(el.id);
            return changes ? { ...el, ...changes } : el;
          }),
          isDirty: true,
        };
      });
    },

    removeElement: (id) => {
      get().actions.saveToHistory();
      set((state) => ({
        elements: state.elements.filter((el) => el.id !== id),
        selectedIds: state.selectedIds.filter((sid) => sid !== id),
        isDirty: true,
      }));
    },

    removeElements: (ids) => {
      get().actions.saveToHistory();
      const idSet = new Set(ids);
      set((state) => ({
        elements: state.elements.filter((el) => !idSet.has(el.id)),
        selectedIds: state.selectedIds.filter((sid) => !idSet.has(sid)),
        isDirty: true,
      }));
    },

    duplicateElements: (ids) => {
      const { elements } = get();
      const idSet = new Set(ids);
      const toDuplicate = elements.filter((el) => idSet.has(el.id));

      const newIds: string[] = [];
      const newElements = toDuplicate.map((el) => {
        const newId = uuidv4();
        newIds.push(newId);
        return {
          ...el,
          id: newId,
          x: el.x + 10,
          y: el.y + 10,
          z: elements.length + newIds.length - 1,
        };
      });

      get().actions.saveToHistory();
      set((state) => ({
        elements: [...state.elements, ...newElements],
        selectedIds: newIds,
        isDirty: true,
      }));

      return newIds;
    },

    // ----------------------------------------
    // 选择操作
    // ----------------------------------------

    setSelection: (ids) => {
      set({ selectedIds: ids });
    },

    addToSelection: (id) => {
      set((state) => ({
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds
          : [...state.selectedIds, id],
      }));
    },

    removeFromSelection: (id) => {
      set((state) => ({
        selectedIds: state.selectedIds.filter((sid) => sid !== id),
      }));
    },

    selectAll: () => {
      set((state) => ({
        selectedIds: state.elements.filter((el) => !el.locked).map((el) => el.id),
      }));
    },

    clearSelection: () => {
      set({ selectedIds: [] });
    },

    // ----------------------------------------
    // 层级操作
    // ----------------------------------------

    bringToFront: (id) => {
      set((state) => {
        const maxZ = Math.max(...state.elements.map((el) => el.z));
        return {
          elements: state.elements.map((el) =>
            el.id === id ? { ...el, z: maxZ + 1 } : el
          ),
          isDirty: true,
        };
      });
    },

    sendToBack: (id) => {
      set((state) => {
        const minZ = Math.min(...state.elements.map((el) => el.z));
        return {
          elements: state.elements.map((el) =>
            el.id === id ? { ...el, z: minZ - 1 } : el
          ),
          isDirty: true,
        };
      });
    },

    bringForward: (id) => {
      set((state) => {
        const element = state.elements.find((el) => el.id === id);
        if (!element) return state;

        const nextZ = state.elements
          .filter((el) => el.z > element.z)
          .sort((a, b) => a.z - b.z)[0]?.z;

        if (nextZ === undefined) return state;

        return {
          elements: state.elements.map((el) =>
            el.id === id ? { ...el, z: nextZ + 0.5 } : el
          ),
          isDirty: true,
        };
      });
    },

    sendBackward: (id) => {
      set((state) => {
        const element = state.elements.find((el) => el.id === id);
        if (!element) return state;

        const prevZ = state.elements
          .filter((el) => el.z < element.z)
          .sort((a, b) => b.z - a.z)[0]?.z;

        if (prevZ === undefined) return state;

        return {
          elements: state.elements.map((el) =>
            el.id === id ? { ...el, z: prevZ - 0.5 } : el
          ),
          isDirty: true,
        };
      });
    },

    // ----------------------------------------
    // 对齐操作
    // ----------------------------------------

    alignElements: (ids, alignment) => {
      if (ids.length < 2) return;

      const { elements } = get();
      const selected = elements.filter((el) => ids.includes(el.id));

      let referenceValue: number;

      switch (alignment) {
        case "left":
          referenceValue = Math.min(...selected.map((el) => el.x));
          break;
        case "center":
          const minX = Math.min(...selected.map((el) => el.x));
          const maxX = Math.max(...selected.map((el) => el.x + el.width));
          referenceValue = (minX + maxX) / 2;
          break;
        case "right":
          referenceValue = Math.max(...selected.map((el) => el.x + el.width));
          break;
        case "top":
          referenceValue = Math.min(...selected.map((el) => el.y));
          break;
        case "middle":
          const minY = Math.min(...selected.map((el) => el.y));
          const maxY = Math.max(...selected.map((el) => el.y + el.height));
          referenceValue = (minY + maxY) / 2;
          break;
        case "bottom":
          referenceValue = Math.max(...selected.map((el) => el.y + el.height));
          break;
      }

      get().actions.saveToHistory();

      const updates = selected.map((el) => {
        let changes: Partial<CanvasElement> = {};

        switch (alignment) {
          case "left":
            changes = { x: referenceValue };
            break;
          case "center":
            changes = { x: referenceValue - el.width / 2 };
            break;
          case "right":
            changes = { x: referenceValue - el.width };
            break;
          case "top":
            changes = { y: referenceValue };
            break;
          case "middle":
            changes = { y: referenceValue - el.height / 2 };
            break;
          case "bottom":
            changes = { y: referenceValue - el.height };
            break;
        }

        return { id: el.id, changes };
      });

      get().actions.updateElements(updates);
    },

    distributeElements: (ids, direction) => {
      if (ids.length < 3) return;

      const { elements } = get();
      const selected = elements
        .filter((el) => ids.includes(el.id))
        .sort((a, b) => (direction === "horizontal" ? a.x - b.x : a.y - b.y));

      const first = selected[0];
      const last = selected[selected.length - 1];

      const totalSpace =
        direction === "horizontal"
          ? last.x + last.width - first.x
          : last.y + last.height - first.y;

      const totalSize = selected.reduce(
        (sum, el) => sum + (direction === "horizontal" ? el.width : el.height),
        0
      );

      const gap = (totalSpace - totalSize) / (selected.length - 1);

      get().actions.saveToHistory();

      let currentPos = direction === "horizontal" ? first.x : first.y;
      const updates = selected.map((el) => {
        const changes: Partial<CanvasElement> =
          direction === "horizontal" ? { x: currentPos } : { y: currentPos };
        currentPos += (direction === "horizontal" ? el.width : el.height) + gap;
        return { id: el.id, changes };
      });

      get().actions.updateElements(updates);
    },

    // ----------------------------------------
    // 画布配置
    // ----------------------------------------

    updateConfig: (changes) => {
      set((state) => ({
        config: { ...state.config, ...changes },
        isDirty: true,
      }));
    },

    setScale: (scale) => {
      set((state) => ({
        config: { ...state.config, scale: Math.max(0.1, Math.min(3, scale)) },
      }));
    },

    toggleGrid: () => {
      set((state) => ({
        config: { ...state.config, showGrid: !state.config.showGrid },
      }));
    },

    toggleRulers: () => {
      set((state) => ({
        config: { ...state.config, showRulers: !state.config.showRulers },
      }));
    },

    toggleSnap: () => {
      set((state) => ({
        config: { ...state.config, snapEnabled: !state.config.snapEnabled },
      }));
    },

    // ----------------------------------------
    // 历史记录
    // ----------------------------------------

    undo: () => {
      set((state) => {
        if (state.history.past.length === 0) return state;

        const previous = state.history.past[state.history.past.length - 1];
        const newPast = state.history.past.slice(0, -1);

        return {
          elements: previous,
          history: {
            past: newPast,
            future: [state.elements, ...state.history.future],
          },
          selectedIds: [],
          isDirty: true,
        };
      });
    },

    redo: () => {
      set((state) => {
        if (state.history.future.length === 0) return state;

        const next = state.history.future[0];
        const newFuture = state.history.future.slice(1);

        return {
          elements: next,
          history: {
            past: [...state.history.past, state.elements],
            future: newFuture,
          },
          selectedIds: [],
          isDirty: true,
        };
      });
    },

    saveToHistory: () => {
      set((state) => ({
        history: {
          past: [...state.history.past.slice(-49), state.elements],
          future: [],
        },
      }));
    },

    clearHistory: () => {
      set({ history: { past: [], future: [] } });
    },

    // ----------------------------------------
    // 文档操作
    // ----------------------------------------

    reset: () => {
      set(initialState);
    },

    loadElements: (elements) => {
      set({
        elements,
        selectedIds: [],
        history: { past: [], future: [] },
        isDirty: false,
      });
    },

    setDirty: (dirty) => {
      set({ isDirty: dirty });
    },
  },
}));

// ============================================
// 选择器 Hooks
// ============================================

export const useSelectedElements = () => {
  const elements = useDesignerStore((state) => state.elements);
  const selectedIds = useDesignerStore((state) => state.selectedIds);
  const selectedSet = new Set(selectedIds);
  return elements.filter((el) => selectedSet.has(el.id));
};

export const useCanUndo = () => {
  return useDesignerStore((state) => state.history.past.length > 0);
};

export const useCanRedo = () => {
  return useDesignerStore((state) => state.history.future.length > 0);
};

export const useDesignerActions = () => {
  return useDesignerStore((state) => state.actions);
};
