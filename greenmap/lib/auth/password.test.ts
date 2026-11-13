import { describe, expect, it } from "vitest";
import {
  PASSWORD_RULES,
  checkPassword,
  isPasswordValid,
  passwordScore,
  passwordStrength,
} from "./password";

describe("password rules", () => {
  it("accepts a password that meets all five rules", () => {
    expect(isPasswordValid("Demo1234!")).toBe(true);
    expect(passwordScore("Demo1234!")).toBe(PASSWORD_RULES.length);
    expect(passwordStrength("Demo1234!")).toBe("strong");
  });

  it("reports exactly which rule fails", () => {
    expect(checkPassword("demo1234!")).toMatchObject({ uppercase: false, lowercase: true });
    expect(checkPassword("DEMO1234!").lowercase).toBe(false);
    expect(checkPassword("DemoDemo!").number).toBe(false);
    expect(checkPassword("Demo12345").symbol).toBe(false);
    expect(checkPassword("De1!").length).toBe(false);
  });

  it("rejects a password that misses any rule", () => {
    for (const weak of ["", "password", "Demo1234", "DEMO1234!", "Dm1!"]) {
      expect(isPasswordValid(weak)).toBe(false);
    }
  });

  it("grades strength from the number of passed rules", () => {
    expect(passwordStrength("")).toBe("weak");
    expect(passwordStrength("abcdefgh")).toBe("weak"); // length + lowercase
    expect(passwordStrength("Abcdefg1")).toBe("fair"); // 4 of 5
  });
});
