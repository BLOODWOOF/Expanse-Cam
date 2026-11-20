package com.lambda.expansecam;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

// Decides what Follow mode looks at: one player, nobody yet (hold), or back to panning.
public final class Director {

	public enum Action { FOLLOW, HOLD, PAN }

	public record Seen(UUID id, double distance) {
	}

	public record Decision(Action action, UUID target) {
	}

	private final int crowdSize;
	private final double idleSeconds;
	private UUID target;
	private double lastSeen = Double.NEGATIVE_INFINITY;

	public Director(int crowdSize, double idleSeconds) {
		this.crowdSize = crowdSize;
		this.idleSeconds = idleSeconds;
	}

	// visible = players in range and in sight right now (not the cam account itself)
	public Decision update(List<Seen> visible, double now) {
		if (visible.size() >= crowdSize) {
			// too many to pick one, just pan, and start fresh once it thins out
			target = null;
			lastSeen = Double.NEGATIVE_INFINITY;
			return new Decision(Action.PAN, null);
		}
		if (!visible.isEmpty()) {
			lastSeen = now;
			if (target == null || visible.stream().noneMatch(s -> s.id().equals(target))) {
				target = visible.stream().min(Comparator.comparingDouble(Seen::distance)).orElseThrow().id();
			}
			return new Decision(Action.FOLLOW, target);
		}
		if (now - lastSeen < idleSeconds) {
			// they might just have stepped behind something
			return new Decision(Action.HOLD, target);
		}
		target = null;
		return new Decision(Action.PAN, null);
	}

	public void reset() {
		target = null;
		lastSeen = Double.NEGATIVE_INFINITY;
	}
}
