import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateInitData } from "../src/server/auth.js";

const TOKEN = "123456:TEST";

function sign(fields: Record<string, string>, token = TOKEN): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const now = 1_800_000_000;
const user = { id: 42, first_name: "Ana" };
const fields = { auth_date: String(now - 60), query_id: "AAA", user: JSON.stringify(user) };

describe("validateInitData", () => {
  it("accepts correctly signed data and returns the user", () => {
    expect(validateInitData(sign(fields), TOKEN, now)).toEqual(user);
  });

  it("rejects data signed with another token", () => {
    expect(validateInitData(sign(fields, "999:OTHER"), TOKEN, now)).toBeNull();
  });

  it("rejects tampered data", () => {
    const tampered = sign(fields).replace("Ana", "Bob");
    expect(validateInitData(tampered, TOKEN, now)).toBeNull();
  });

  it("rejects stale data", () => {
    expect(validateInitData(sign({ ...fields, auth_date: String(now - 2 * 86400) }), TOKEN, now)).toBeNull();
  });

  it("rejects missing hash", () => {
    expect(validateInitData("user=%7B%7D", TOKEN, now)).toBeNull();
  });
});
