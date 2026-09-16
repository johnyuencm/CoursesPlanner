import { strict as assert } from "node:assert";
import test from "node:test";
import { createRef } from "react";
import { GraphZoomScrollFrame } from "../components/graph-canvas";

test("zoom out preserves the pre-shrink center even when DOM layout clamps scrolling", () => {
  const scrollRef = createRef<HTMLDivElement>();
  const viewport = {
    scrollLeft: 1200, scrollTop: 700, clientWidth: 400, clientHeight: 300,
    scrollTo(position: ScrollToOptions) {
      this.scrollLeft = position.left ?? this.scrollLeft;
      this.scrollTop = position.top ?? this.scrollTop;
    },
  };
  Object.defineProperty(scrollRef, "current", { value: viewport });
  const previous = { zoom: 1, scrollRef };
  const frame = new GraphZoomScrollFrame({ zoom: 0.5, scrollRef });
  // React captures before committing the smaller child dimensions.
  const snapshot = frame.getSnapshotBeforeUpdate(previous);
  viewport.scrollLeft = 600;
  viewport.scrollTop = 400;
  frame.componentDidUpdate(previous, null, snapshot);
  assert.equal(viewport.scrollLeft, 500);
  assert.equal(viewport.scrollTop, 275);
  assert.equal(frame.getSnapshotBeforeUpdate({ zoom: 0.5, scrollRef }), null);
});
