package com.lambda.expansecam;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class DirectorTest {

	private static final UUID A = new UUID(0, 1);
	private static final UUID B = new UUID(0, 2);

	private static Director.Seen seen(UUID id, double dist) {
		return new Director.Seen(id, dist);
	}

	private static List<Director.Seen> crowd(int n) {
		return java.util.stream.IntStream.range(0, n).mapToObj(i -> seen(new UUID(1, i), 5 + i)).toList();
	}

	@Test
	void nobodyEverSeenPansStraightAway() {
		Director d = new Director(5, 5);
		Director.Decision dec = d.update(List.of(), 0);
		assertEquals(Director.Action.PAN, dec.action());
		assertNull(dec.target());
	}

	@Test
	void followsTheFirstPersonSeen() {
		Director d = new Director(5, 5);
		Director.Decision dec = d.update(List.of(seen(A, 10)), 1);
		assertEquals(Director.Action.FOLLOW, dec.action());
		assertEquals(A, dec.target());
	}

	@Test
	void keepsItsTargetEvenWhenSomeoneCloserShowsUp() {
		Director d = new Director(5, 5);
		d.update(List.of(seen(A, 10)), 1);
		assertEquals(A, d.update(List.of(seen(B, 2), seen(A, 12)), 2).target());
	}

	@Test
	void picksTheNearestWhenTheTargetIsGone() {
		Director d = new Director(5, 5);
		d.update(List.of(seen(A, 10)), 1);
		Director.Decision dec = d.update(List.of(seen(B, 8), seen(new UUID(0, 3), 4)), 2);
		assertEquals(new UUID(0, 3), dec.target());
	}

	@Test
	void holdsBrieflyThenGoesBackToPanning() {
		Director d = new Director(5, 5);
		d.update(List.of(seen(A, 10)), 1);
		assertEquals(Director.Action.HOLD, d.update(List.of(), 3).action());
		assertEquals(Director.Action.HOLD, d.update(List.of(), 5.9).action());
		assertEquals(Director.Action.PAN, d.update(List.of(), 6.1).action());
	}

	@Test
	void comingBackDuringTheHoldPicksThemUpAgain() {
		Director d = new Director(5, 5);
		d.update(List.of(seen(A, 10)), 1);
		d.update(List.of(), 3);
		assertEquals(A, d.update(List.of(seen(A, 9)), 4).target());
	}

	@Test
	void aCrowdMeansPan() {
		Director d = new Director(5, 5);
		d.update(List.of(seen(A, 10)), 1);
		assertEquals(Director.Action.PAN, d.update(crowd(5), 2).action());
		assertEquals(Director.Action.FOLLOW, d.update(crowd(4), 3).action());
	}

	@Test
	void afterACrowdItStartsFreshWithTheNearest() {
		Director d = new Director(5, 5);
		d.update(List.of(seen(A, 10)), 1);
		d.update(crowd(6), 2);
		assertEquals(B, d.update(List.of(seen(A, 10), seen(B, 3)), 3).target());
	}
}
