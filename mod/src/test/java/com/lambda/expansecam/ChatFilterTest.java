package com.lambda.expansecam;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChatFilterTest {

	@Test
	void privateMessagesAreDropped() {
		assertFalse(ChatFilter.keepChat("minecraft:msg_command_incoming"));
		assertFalse(ChatFilter.keepChat("minecraft:msg_command_outgoing"));
		assertTrue(ChatFilter.keepChat("minecraft:chat"));
		assertTrue(ChatFilter.keepChat("minecraft:say_command"));
	}

	@Test
	void whisperLookingServerMessagesAreDropped() {
		assertFalse(ChatFilter.keepGame("[Steve -> me] hey", false));
		assertFalse(ChatFilter.keepGame("[me -> Steve] hey", false));
		assertFalse(ChatFilter.keepGame("Steve -> You: hey", false));
		assertFalse(ChatFilter.keepGame("Steve whispers to you: hey", false));
		assertFalse(ChatFilter.keepGame("You whisper to Steve: hey", false));
	}

	@Test
	void actionBarIsDropped() {
		assertFalse(ChatFilter.keepGame("anything", true));
	}

	@Test
	void normalServerMessagesStay() {
		assertTrue(ChatFilter.keepGame("Steve joined the game", false));
		assertTrue(ChatFilter.keepGame("Steve was slain by Zombie", false));
		assertTrue(ChatFilter.keepGame("<Steve> where's the shop", false));
	}

	@Test
	void blankIsDropped() {
		assertFalse(ChatFilter.keepGame("   ", false));
	}
}
