# 🧠 `claude.md`

## Project

**Flow Studio — Digital Time-Series Workstation (UI-Only)**

---

## 🎯 Purpose

A **DAW-style front end** for industrial time-series data.
Each *track* represents an **aspect**, each *clip* represents a **time window of data**.

Users can:

* Create, move, resize clips.
* Select any region of a clip and copy/paste it.
* Paste to another time in the same track or a different track.
* Watch asynchronous *“data transfer”* progress as the system fills the clip.

All data interactions are **mocked**; there is no real API, SDK, or CLI dependency.

---

## 🧩 Core Concept

| Concept       | Description                                                                     |
| ------------- | ------------------------------------------------------------------------------- |
| **Project**   | Represents a single asset (e.g. *Primary Crusher*).                             |
| **Track**     | Represents an aspect (e.g. `OEE_Data`, `Electric_Motor_Data`).                  |
| **Clip**      | Represents time-series data for a time window — appears as a rectangular block. |
| **Selection** | A partial region of a clip chosen for copy/paste.                               |
| **Job**       | A background task representing a mock data transfer (download/upload).          |

---

## 🧠 Fundamental Rule

> Wherever there is time-series data on a track, there is a **clip**.
> You can **select any portion of that clip** (or the whole thing) and **copy/paste** it to another location —
> either to a different time frame on the same track, or to a different track.

The UI must behave like a **digital audio workstation (DAW)** such as Propellerhead Reason or Ableton Live —
immediate visual response, asynchronous data updates underneath.

---

## ⚙️ Functional Goals

| Area                  | Functionality                                                      |
| --------------------- | ------------------------------------------------------------------ |
| **Timeline view**     | Horizontal, zoomable grid showing all tracks.                      |
| **Tracks**            | Each track = aspect; labelled; stacked vertically.                 |
| **Clips**             | Rectangular blocks showing existing data windows.                  |
| **Selection overlay** | Drag across part of a clip to define selection.                    |
| **Clipboard logic**   | Copy/paste selection regions with `Ctrl/Cmd+C` and `Ctrl/Cmd+V`.   |
| **Paste behaviour**   | Paste to same/different track → creates new clip instantly.        |
| **Progress feedback** | Progress bar fills left→right during mock data transfer.           |
| **Inspector panel**   | Shows clip details (aspect, duration, record count, bytes, state). |
| **Job queue panel**   | Shows active and completed jobs with statuses.                     |
| **Config drawer**     | Demo asset IDs and mock control toggles.                           |

---

## 🚫 Non-Goals

* No API or SDK integration.
* No authentication or persistence.
* No CLI invocation.
* No data visualisation beyond clip layout.

---

## 🧱 Tech Stack

| Layer                | Technology                             |
| -------------------- | -------------------------------------- |
| UI                   | React + TypeScript                     |
| State management     | Zustand                                |
| Animations           | Framer Motion                          |
| Styling              | Tailwind or CSS Modules                |
| Mock data simulation | `mockBackend.ts` (custom EventEmitter) |

---

## 📁 Folder Structure

```
/src
  /components
    Timeline/
    Track/
    Clip/
    SelectionOverlay/
    Inspector/
    Queue/
    ConfigDrawer/
  /state
    store.ts
    clips.ts
    jobs.ts
  /services
    mockBackend.ts
  /types
    clip.ts
    job.ts
  /utils
    time.ts
```

---

## 📦 Data Models

### Clip

```ts
interface Clip {
  id: string;
  track: string;  // aspect name
  from: string;   // ISO start timestamp
  to: string;     // ISO end timestamp
  status: "pending" | "running" | "ready" | "error";
  progress: number; // 0–100
  records: number;
  bytes: number;
  sourceClipId?: string;   // if copied from another
  copiedFrom?: { from: string; to: string }; // original window
}
```

### Job

```ts
interface Job {
  id: string;
  clipId: string;
  type: "download" | "upload";
  progress: number;
  status: "pending" | "running" | "ready" | "error";
  startedAt: string;
  finishedAt?: string;
}
```

---

## 🎮 Copy & Paste Behaviour (Core Feature)

### Selection

* Drag across a clip → translucent **selection overlay** showing region.
* Click outside to deselect.

### Copy

* **Ctrl/Cmd + C** or context menu → *Copy Selection*.
* Stored in clipboard state:

  ```ts
  { sourceClipId, from, to, track }
  ```

### Paste

* **Ctrl/Cmd + V** or context menu → *Paste*.
* If pasted on same track → create a new clip offset to target time.
* If pasted on different track → same relative duration, aligned vertically.
* New clip instantly appears (`status="pending"`).
* Mock backend starts upload simulation → progress bar fills → ready/error.

### Visual cues

| State               | Appearance                          |
| ------------------- | ----------------------------------- |
| **Pending**         | Light grey or translucent clip      |
| **Running**         | Blue fill progress bar left→right   |
| **Ready**           | Solid green tint                    |
| **Error**           | Red outline + ⚠ icon                |
| **Selected region** | Bright overlay on top of clip       |
| **Copied clip**     | Flash animation or border highlight |

---

## 🧩 Mock Backend Design

`/src/services/mockBackend.ts`

Simulates download/upload calls.
All operations are async with artificial delay and progress events.

### Interface

```ts
import { EventEmitter } from "events";

export const mockBus = new EventEmitter();

export async function downloadAspect(clipId, assetId, aspect, from, to);
export async function uploadAspect(clipId, assetId, aspect);
export function getAspects(assetId): string[];
```

### Behaviour

* Each job lasts **5–15 seconds**.
* Emits `"progress"` and `"done"` events.
* 10 % failure rate to simulate errors.
* Emits random record/byte counts.

---

## 🪶 Example Mock Progress Logic

```ts
while (percent < 100) {
  await sleep(200 + Math.random() * 300);
  percent = Math.min(100, ((Date.now() - start) / total) * 100);
  mockBus.emit("progress", { clipId, percent });
}
mockBus.emit("done", { clipId, success });
```

---

## 🧭 Visual Specification

| Element           | Description                                       |
| ----------------- | ------------------------------------------------- |
| **Tracks**        | 48 px tall rows, alternating grey background.     |
| **Clips**         | Rounded 4 px, subtle gradient, light drop shadow. |
| **Progress bar**  | 4 px stripe inside clip filling left→right.       |
| **Timeline grid** | Faint vertical lines; draggable viewport.         |
| **Font**          | System default, 13–14 px, neutral grey text.      |

---

## 🧩 State Flow Summary

```
Create clip → status=pending
↓
Mock job starts → running
↓
Progress events update clip.progress
↓
On completion → ready or error
↓
UI updates job queue and inspector
```

Copy/paste actions reuse this flow but start with source clip data.

---

## ✅ MVP Acceptance Criteria

* Renders 3 default tracks: `OEE_Data`, `OEE_KPIs`, `Electric_Motor_Data`.
* User can:

  * Create clips by dragging on timeline.
  * Select region of existing clip.
  * Copy/paste regions to any track or time.
  * Observe live progress bar filling.
  * See clip status and metadata in inspector.
  * Monitor jobs in queue panel.
* All operations run locally with mocked latency.
* No console errors or external dependencies.

---

## 🧩 Later Enhancements (Not for MVP)

* Real SDK / API integration.
* Persistence (save/load projects).
* Variable mapping across aspects.
* Multi-selection and batch paste.
* Keyboard nudge / snap-to-grid.
* Zoom and scroll memory.

---

## 🔑 Design Philosophy

* Immediate, musical **feel** even though data operations are asynchronous.
* The mock backend never blocks the UI.
* Everything happens *optimistically* — clips appear first, data catches up later.
* The progress animation provides feedback for latency.
