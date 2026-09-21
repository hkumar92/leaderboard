import { describe, expect, test } from "bun:test";
import { isBotAccount, isProductRepo, mergeContributors } from "./github-contributors";

describe("isBotAccount", () => {
  test("filters GitHub bots", () => {
    expect(isBotAccount("dependabot[bot]", "Bot")).toBe(true);
    expect(isBotAccount("renovate[bot]")).toBe(true);
    expect(isBotAccount("olearycrew", "User")).toBe(false);
  });
});

describe("isProductRepo", () => {
  test("keeps public source repos and skips forks, archives, and dotfiles", () => {
    expect(
      isProductRepo({
        name: "skill",
        html_url: "https://github.com/pinchbench/skill",
        description: null,
        fork: false,
        archived: false,
      }),
    ).toBe(true);
    expect(
      isProductRepo({
        name: ".github",
        html_url: "https://github.com/pinchbench/.github",
        description: null,
        fork: false,
        archived: false,
      }),
    ).toBe(false);
    expect(
      isProductRepo({
        name: "skill",
        html_url: "https://github.com/pinchbench/skill",
        description: null,
        fork: true,
        archived: false,
      }),
    ).toBe(false);
  });
});

describe("mergeContributors", () => {
  test("sums commits across repos and skips bots", () => {
    const merged = mergeContributors([
      {
        repo: "skill",
        contributors: [
          { login: "ada", contributions: 10, type: "User", html_url: "https://github.com/ada", avatar_url: "a" },
          { login: "dependabot[bot]", contributions: 99, type: "Bot" },
        ],
      },
      {
        repo: "api",
        contributors: [
          { login: "ada", contributions: 4, type: "User", html_url: "https://github.com/ada", avatar_url: "a" },
          { login: "bob", contributions: 12, type: "User", html_url: "https://github.com/bob", avatar_url: "b" },
        ],
      },
    ]);

    expect(merged.map((person) => person.login)).toEqual(["ada", "bob"]);
    expect(merged[0]).toMatchObject({
      login: "ada",
      contributions: 14,
      repos: ["skill", "api"],
    });
  });
});
