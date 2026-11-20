package com.lambda.expansecam;

import java.util.regex.Pattern;

// Decides which chat lines go to the website. Private messages never do.
public final class ChatFilter {

	// plugin-style whispers that arrive as plain server messages
	private static final Pattern WHISPER = Pattern.compile(
			"^\\[?\\s*(me|you|\\S+)\\s*->\\s*(me|you|\\S+)\\s*\\]?\\s*:?|whispers? to|whispers you",
			Pattern.CASE_INSENSITIVE);

	private ChatFilter() {
	}

	public static boolean keepChat(String chatTypeId) {
		return !chatTypeId.startsWith("minecraft:msg_command");
	}

	public static boolean keepGame(String text, boolean overlay) {
		if (overlay || text.isBlank()) {
			return false;
		}
		return !WHISPER.matcher(text.strip()).find();
	}
}
