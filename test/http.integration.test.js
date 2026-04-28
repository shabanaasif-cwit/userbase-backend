import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
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
    process.env.FRONTEND_ORIGIN = "http://localhost:3000";
    process.env.NODE_ENV = "test";
    process.env.ADMIN_KEY =
      process.env.ADMIN_KEY?.trim() || "integration-test-admin-key";

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
    expect(res.body).toEqual({ error: "Invalid JSON", message: "Invalid JSON" });
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
    expect(meNoAuth.body).toEqual({ error: "Unauthorized", message: "Unauthorized" });

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
    expect(badLogin.body).toEqual({
      error: "Wrong Password",
      message: "Wrong Password",
    });
  });

  it("auth: second login without refresh cookie while session active returns 409", async () => {
    const email = "user-single-session@test.com";
    const signup = await request(app).post("/api/auth/signup").send({
      email,
      password,
      confirmPassword: password,
      role: "user",
    });
    expect(signup.status).toBe(201);

    const secondLogin = await request(app).post("/api/auth/login").send({
      email,
      password,
      role: "user",
    });
    expect(secondLogin.status).toBe(409);
    expect(secondLogin.body).toEqual({
      error: "Session is already logged in.",
      message: "Session is already logged in.",
    });
  });

  it("auth: login again with same cookie after signup succeeds (same browser)", async () => {
    const email = "same-browser@test.com";
    const agent = request.agent(app);
    const signup = await agent.post("/api/auth/signup").send({
      email,
      password,
      confirmPassword: password,
      role: "user",
    });
    expect(signup.status).toBe(201);

    const again = await agent.post("/api/auth/login").send({
      email,
      password,
      role: "user",
    });
    expect(again.status).toBe(200);
    expect(again.body.accessToken).toBeTruthy();
    expect(again.body.user.email).toBe(email);
  });

  it("auth: login with unknown email returns 401 Incorrect email", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "nobody-exists-here@test.com",
      password,
      role: "user",
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: "Incorrect email",
      message: "Incorrect email",
    });
  });

  it("auth: login with email missing @ returns 400 Missing @ symbol", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "nousernameonly",
      password,
      role: "user",
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Missing @ symbol",
      message: "Missing @ symbol",
    });
  });

  it("auth: login with missing email returns 400 Email is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({
      password,
      role: "user",
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Email is missing",
      message: "Email is missing",
    });
  });

  it("auth: login with missing password returns 400 Password is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "someone@test.com",
      role: "user",
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Password is missing",
      message: "Password is missing",
    });
  });

  it("auth: signup with email missing @ returns 400 Missing @ symbol", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "nousernameonly",
      password,
      confirmPassword: password,
      role: "user",
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Missing @ symbol",
      message: "Missing @ symbol",
    });
  });

  it("auth: signup rejects duplicate email across user and admin", async () => {
    const sharedEmail = "dup-identity@test.com";
    const asUser = await request(app).post("/api/auth/signup").send({
      email: sharedEmail,
      password,
      confirmPassword: password,
      role: "user",
    });
    expect(asUser.status).toBe(201);

    const duplicateAsAdmin = await request(app).post("/api/auth/signup").send({
      email: sharedEmail,
      password,
      confirmPassword: password,
      role: "admin",
      adminKey: process.env.ADMIN_KEY,
    });
    expect(duplicateAsAdmin.status).toBe(409);
    expect(duplicateAsAdmin.body.error).toMatch(/That email is taken. Try another./);

    const adminEmail = "dup-identity-admin@test.com";
    const asAdmin = await request(app).post("/api/auth/signup").send({
      email: adminEmail,
      password,
      confirmPassword: password,
      role: "admin",
      adminKey: process.env.ADMIN_KEY,
    });
    expect(asAdmin.status).toBe(201);

    const duplicateAsUser = await request(app).post("/api/auth/signup").send({
      email: adminEmail,
      password,
      confirmPassword: password,
      role: "user",
    });
    expect(duplicateAsUser.status).toBe(409);
    expect(duplicateAsUser.body.error).toMatch(/That email is taken. Try another./);
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
    expect(list.body).toEqual({
      error: "Forbidden (admin only)",
      message: "Forbidden (admin only)",
    });
  });

  it("RBAC: admin can list users", async () => {
    const signup = await request(app).post("/api/auth/signup").send({
      email: "rbac-admin@test.com",
      password,
      confirmPassword: password,
      role: "admin",
      adminKey: process.env.ADMIN_KEY,
    });
    expect(signup.status).toBe(201);

    const list = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${signup.body.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveProperty("items");
    expect(list.body).toHaveProperty("meta");
  });

  it("users: admin can toggle account status via PATCH toggle-account", async () => {
    const adminSignup = await request(app).post("/api/auth/signup").send({
      email: "toggle-admin@test.com",
      password,
      confirmPassword: password,
      role: "admin",
      adminKey: process.env.ADMIN_KEY,
    });
    expect(adminSignup.status).toBe(201);

    const userSignup = await request(app).post("/api/auth/signup").send({
      email: "toggle-target@test.com",
      password,
      confirmPassword: password,
      role: "user",
    });
    expect(userSignup.status).toBe(201);
    const targetId = userSignup.body.user.id;
    const adminToken = adminSignup.body.accessToken;

    const off = await request(app)
      .patch(`/api/users/${targetId}/toggle-account`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(off.status).toBe(200);
    expect(off.body.user.accountStatus).toBe("deactivated");

    const on = await request(app)
      .patch(`/api/users/${targetId}/toggle-account`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(on.status).toBe(200);
    expect(on.body.user.accountStatus).toBe("active");
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
        targetType: "user",
      });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({
      error: "Forbidden (admin only)",
      message: "Forbidden (admin only)",
    });

    const adminSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-admin@test.com",
      password,
      confirmPassword: password,
      role: "admin",
      adminKey: process.env.ADMIN_KEY,
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
      adminKey: process.env.ADMIN_KEY,
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

  it("notifications: admin can send reminder for an existing notification", async () => {
    const userSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-remind-user@test.com",
      password,
      confirmPassword: password,
      role: "user",
    });
    expect(userSignup.status).toBe(201);
    const userId = userSignup.body.user.id;
    const userToken = userSignup.body.accessToken;

    const adminSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-remind-admin@test.com",
      password,
      confirmPassword: password,
      role: "admin",
      adminKey: process.env.ADMIN_KEY,
    });
    expect(adminSignup.status).toBe(201);
    const adminToken = adminSignup.body.accessToken;

    const created = await request(app)
      .post("/api/notifications")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Original",
        body: "Original body",
        targetType: "users",
        targetUsers: [userId],
      });
    expect(created.status).toBe(201);
    const originalId = created.body.notification.id;

    const reminded = await request(app)
      .post(`/api/notifications/${originalId}/remind`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Reminder", body: "Please read" });
    expect(reminded.status).toBe(201);
    expect(reminded.body.reminder.notificationId).toBe(originalId);

    const list = await request(app)
      .get("/api/reminders")
      .set("Authorization", `Bearer ${userToken}`);
    expect(list.status).toBe(200);
    expect(list.body.items.some((r) => r.notificationId === originalId)).toBe(true);
  });

  it("notifications: admin remind on targetType=user resolves app users", async () => {
    const userSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-remind-usertype@test.com",
      password,
      confirmPassword: password,
      role: "user",
    });
    expect(userSignup.status).toBe(201);
    const userToken = userSignup.body.accessToken;

    const adminSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-remind-usertype-admin@test.com",
      password,
      confirmPassword: password,
      role: "admin",
      adminKey: process.env.ADMIN_KEY,
    });
    expect(adminSignup.status).toBe(201);
    const adminToken = adminSignup.body.accessToken;

    const created = await request(app)
      .post("/api/notifications")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "All users",
        body: "Hello everyone",
        targetType: "user",
      });
    expect(created.status).toBe(201);
    const originalId = created.body.notification.id;

    const reminded = await request(app)
      .post(`/api/notifications/${originalId}/remind`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Reminder", body: "Please read" });
    expect(reminded.status).toBe(201);

    const list = await request(app)
      .get("/api/reminders")
      .set("Authorization", `Bearer ${userToken}`);
    expect(list.status).toBe(200);
    expect(list.body.items.some((r) => r.notificationId === originalId)).toBe(true);
  });

  it("notifications: admin remind on targetType=admin does not add regular users as recipients", async () => {
    const userSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-remind-admintype-user@test.com",
      password,
      confirmPassword: password,
      role: "user",
    });
    expect(userSignup.status).toBe(201);
    const userToken = userSignup.body.accessToken;

    const adminSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-remind-admintype-admin@test.com",
      password,
      confirmPassword: password,
      role: "admin",
      adminKey: process.env.ADMIN_KEY,
    });
    expect(adminSignup.status).toBe(201);
    const adminToken = adminSignup.body.accessToken;

    const created = await request(app)
      .post("/api/notifications")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Admins only",
        body: "Internal",
        targetType: "admin",
      });
    expect(created.status).toBe(201);
    const originalId = created.body.notification.id;

    const reminded = await request(app)
      .post(`/api/notifications/${originalId}/remind`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Reminder", body: "Action needed" });
    expect(reminded.status).toBe(201);

    const userList = await request(app)
      .get("/api/reminders")
      .set("Authorization", `Bearer ${userToken}`);
    expect(userList.status).toBe(200);
    expect(
      userList.body.items.some((r) => r.notificationId === originalId)
    ).toBe(false);

    const adminList = await request(app)
      .get("/api/reminders")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminList.status).toBe(200);
    expect(
      adminList.body.items.some((r) => r.notificationId === originalId)
    ).toBe(true);
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
      adminKey: process.env.ADMIN_KEY,
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
    expect(patch.body).toEqual({
      error: "Forbidden (admin only)",
      message: "Forbidden (admin only)",
    });
  });

  it("notifications: PATCH update rejects empty body object after validation keys", async () => {
    const adminSignup = await request(app).post("/api/auth/signup").send({
      email: "notif-patch-admin2@test.com",
      password,
      confirmPassword: password,
      role: "admin",
      adminKey: process.env.ADMIN_KEY,
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

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const emptyPatch = await request(app)
        .patch(`/api/notifications/${notificationId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ targetUsers: [userId] });
      expect(emptyPatch.status).toBe(400);
      expect(emptyPatch.body.error).toMatch(/No fields are updated/);

      const errLines = errorSpy.mock.calls.map((args) => String(args[0]));
      expect(
        errLines.some(
          (line) =>
            line.includes("PATCH") &&
            line.includes("/api/notifications/") &&
            line.includes("400") &&
            line.includes("No fields are updated")
        )
      ).toBe(true);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("client-errors: POST reports frontend error and returns 204", async () => {
    const res = await request(app).post("/api/client-errors").send({
      message: "Test client error",
      stack: "at foo (bar.js:1:1)",
      url: "http://localhost:3000/page",
    });
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
  });

  it("navigation: POST logs SPA route and returns 204; missing path is 400", async () => {
    const ok = await request(app).post("/api/navigation").send({
      path: "/dashboard",
      title: "Dashboard",
    });
    expect(ok.status).toBe(204);

    const noPath = await request(app).post("/api/navigation").send({});
    expect(noPath.status).toBe(400);
    expect(noPath.body).toEqual({ error: "path is required", message: "path is required" });

    const implicitSlash = await request(app).post("/api/navigation").send({
      path: "settings",
    });
    expect(implicitSlash.status).toBe(204);
  });
});
