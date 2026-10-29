"""Hybrid logical clock helpers shared by sync validation and merge code.

The browser owns the clock value, but the server validates its shape and uses
the tuple ordering ``physical-ms, logical-counter, device-id``.  Including the
device id makes equal clocks deterministic even when two devices have the same
wall-clock millisecond.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, order=True)
class HlcValue:
    """A sortable HLC value represented as integers plus a tie-breaker."""

    physical_ms: int
    logical: int
    device_id: str


def normalize_hlc(value: str, device_id: str) -> str:
    """Validate and normalize ``physical.logical`` input with a device tie-breaker."""

    parts = value.strip().split(".")
    if len(parts) != 2 or not all(part.isdigit() for part in parts):
        raise ValueError("HLC must use the physical.logical format")
    physical_ms, logical = (int(part) for part in parts)
    if physical_ms < 0 or logical < 0 or physical_ms > 9_999_999_999_999:
        raise ValueError("HLC values are outside the supported range")
    device = device_id.strip()
    if not device or len(device) > 128:
        raise ValueError("device id is required for HLC ordering")
    return f"{physical_ms}.{logical}"


def parse_hlc(value: str, device_id: str) -> HlcValue:
    """Parse a validated HLC and attach its deterministic device tie-breaker."""

    normalized = normalize_hlc(value, device_id)
    physical, logical = (int(part) for part in normalized.split("."))
    return HlcValue(physical, logical, device_id.strip())


def compare_hlc(left: tuple[str, str], right: tuple[str, str]) -> int:
    """Return -1, 0, or 1 using deterministic HLC ordering."""

    left_value = parse_hlc(*left)
    right_value = parse_hlc(*right)
    return (left_value > right_value) - (left_value < right_value)
