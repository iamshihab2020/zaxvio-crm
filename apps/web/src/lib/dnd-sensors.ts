import type { PointerEvent as ReactPointerEvent } from "react";
import { PointerSensor, type PointerSensorOptions } from "@dnd-kit/core";

/**
 * The stock PointerSensor, minus fingers.
 *
 * A pointer sensor with an 8px distance threshold treats the first 8px of any
 * touch as a drag, so on a phone a swipe across something draggable lifted it
 * instead of scrolling. Mouse and pen keep exactly that behaviour; pair this
 * with dnd-kit's TouchSensor and a press-and-hold delay, so a swipe is a scroll
 * and a hold is a drag. Used by the Pipeline board and the dashboard's
 * Arrange view.
 */
export class MousePenSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: (
        { nativeEvent: event }: ReactPointerEvent,
        { onActivation }: PointerSensorOptions,
      ) => {
        if (event.pointerType === "touch") return false;
        if (!event.isPrimary || event.button !== 0) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}
