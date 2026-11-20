package com.lambda.expansecam;

import com.google.gson.Gson;

// What the web page reads from camera.json
public record CameraState(boolean online, String dimension, int x, int y, int z, float yaw, float swing, long updated) {

	private static final Gson GSON = new Gson();

	public CameraState offline(long now) {
		return new CameraState(false, dimension, x, y, z, yaw, swing, now);
	}

	public String toJson() {
		return GSON.toJson(this);
	}
}
