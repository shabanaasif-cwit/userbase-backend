import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";

const password = "Password1@";

describe.sequential("HTTP integration (auth, RBAC, users, notifications)", () => {
  let mongod;
  let app;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_ACCESS_SECRET = "a".repeat(32);
    process.env.JWT_REFRESH_SECRET = "b".repeat(32);
    process.env.FRONTEND_ORIGIN = "http://localhost:5173";
    process.env.NODE_ENV = "test";

    const { createApp } = await import("../src/app.js");
    const { connectMongo } = await import("../src/db/connect.js");
    await connectMongo();
    app = createApp();
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  it("returns 400 Invalid JSON for malformed JSON body", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid JSON" });
  });

  it("auth: signup rejects weak password with 400 and error message", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "weak@test.com",
      password: "short",
      confirmPassword: "short",
      role: "user",
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
  });

  it("auth: signup, me with bearer, login, wrong password 401", async () => {
    const email = "user-auth@test.com";
    const signup = await request(app).post("/api/auth/signup").send({
      email,
      password,
      confirmPassword: password,
      role: "user",
    });
    expect(signup.status).toBe(201);
    expect(signup.body.accessToken).toBeTruthy();

    const meNoAuth = await request(app).get("/api/auth/me");
    expect(meNoAuth.status).toBe(401);
    expect(meNoAuth.body).toEqual({ error: "Unauthorized" });

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${signup.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);

    const badLogin = await request(app).post("/api/auth/login").send({
      email,
      password: "WrongPass1@",
      role: "user",
    });
    expect(badLogin.status).toBe(401);
    expect(badLogin.body).toEqual({ error: "Invalid credentials" });
  });

  it("RBAC: regular user gets 403 on admin user list", async () => {
    const signup = await request(app).post("/api/auth/signup").send({
      email: "rbac-user@test.com",
      password,
      confirmPassword: password,
      role: "user",
    });
    expect(signup.status).toBe(201);

    const list = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${signup.body.accessToken}`);
    expect(list.status).toBe(403);
    expect(list.body).toEqual({ error: "Forbidden (admin only)" });
  });

  it("RBAC: admin can list users", async () => {
    const signup = await request(app).post("/api/auth/signup").send({
      email: "rbac-admin@test.com",
      password,
      confirmPassword: password,
      role: "admin",
    });
    expect(signup.status).toBe(201);

    const list = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${signup.body.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveProperty("items");
    expect(list.body).toHaveProperty("meta");
  });

  it("notifications: validation and RBAC on create", async () => {
    const userSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-user@test.com",
      password,
      confirmPassword: password,
      role: "user",
    });
    expect(userSignup.status).toBe(201);

    const forbidden = await request(app)
      .post("/api/notifications")
      .set("Authorization", `Bearer ${userSignup.body.accessToken}`)
      .send({
        title: "Hi",
        body: "There",
        targetType: "role",
        targetRoles: ["user"],
      });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ error: "Forbidden (admin only)" });

    const adminSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-admin@test.com",
      password,
      confirmPassword: password,
      role: "admin",
    });
    expect(adminSignup.status).toBe(201);
    const adminToken = adminSignup.body.accessToken;

    const badPayload = await request(app)
      .post("/api/notifications")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "t",
        body: "b",
        targetType: "users",
        targetUsers: "not-array",
      });
    expect(badPayload.status).toBe(400);
    expect(badPayload.body.error).toMatch(/targetUsers must be an array/);
  });

  it("notifications: admin targets user, user lists, marks read, filters read=true", async () => {
    const userSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-flow-user@test.com",
      password,
      confirmPassword: password,
      role: "user",
    });
    expect(userSignup.status).toBe(201);
    const userId = userSignup.body.user.id;
    const userToken = userSignup.body.accessToken;

    const adminSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-flow-admin@test.com",
      password,
      confirmPassword: password,
      role: "admin",
    });
    expect(adminSignup.status).toBe(201);
    const adminToken = adminSignup.body.accessToken;

    const created = await request(app)
      .post("/api/notifications")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Hello",
        body: "World",
        targetType: "users",
        targetUsers: [userId],
      });
    expect(created.status).toBe(201);
    const notificationId = created.body.notification.id;
    expect(created.body.notification.myRead).toBe(false);

    const listBefore = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${userToken}`);
    expect(listBefore.status).toBe(200);
    expect(listBefore.body.items.some((n) => n.id === notificationId)).toBe(
      true
    );
    const item = listBefore.body.items.find((n) => n.id === notificationId);
    expect(item.myRead).toBe(false);

    const readRes = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.notification.myRead).toBe(true);

    const listUnread = await request(app)
      .get("/api/notifications")
      .query({ read: "false" })
      .set("Authorization", `Bearer ${userToken}`);
    expect(listUnread.status).toBe(200);
    expect(listUnread.body.items.some((n) => n.id === notificationId)).toBe(
      false
    );

    const listRead = await request(app)
      .get("/api/notifications")
      .query({ read: "true" })
      .set("Authorization", `Bearer ${userToken}`);
    expect(listRead.status).toBe(200);
    expect(listRead.body.items.some((n) => n.id === notificationId)).toBe(true);
  });

  it("notifications: user cannot patch admin update endpoint", async () => {
    const userSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-patch-user@test.com",
      password,
      confirmPassword: password,
      role: "user",
    });
    const adminSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-patch-admin@test.com",
      password,
      confirmPassword: password,
      role: "admin",
    });
    const adminToken = adminSignup.body.accessToken;
    const userToken = userSignup.body.accessToken;
    const userId = userSignup.body.user.id;

    const created = await request(app)
      .post("/api/notifications")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "T",
        body: "B",
        targetType: "users",
        targetUsers: [userId],
      });
    const notificationId = created.body.notification.id;

    const patch = await request(app)
      .patch(`/api/notifications/${notificationId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ title: "Nope" });
    expect(patch.status).toBe(403);
    expect(patch.body).toEqual({ error: "Forbidden (admin only)" });
  });

  it("notifications: PATCH update rejects empty body object after validation keys", async () => {
    const adminSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-patch-admin2@test.com",
      password,
      confirmPassword: password,
      role: "admin",
    });
    const adminToken = adminSignup.body.accessToken;
    const userSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-patch-target@test.com",
      password,
      confirmPassword: password,
      role: "user",
    });
    const userId = userSignup.body.user.id;

    const created = await request(app)
      .post("/api/notifications")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "T2",
        body: "B2",
        targetType: "users",
        targetUsers: [userId],
      });
    const notificationId = created.body.notification.id;

    const emptyPatch = await request(app)
      .patch(`/api/notifications/${notificationId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ targetUsers: [userId] });
    expect(emptyPatch.status).toBe(400);
    expect(emptyPatch.body.error).toMatch(/No valid fields to update/);
  });
});
