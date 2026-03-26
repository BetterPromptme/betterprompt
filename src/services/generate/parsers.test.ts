import { describe, expect, it } from "bun:test";
import { join } from "path";

import { processImagePath } from "./parsers";

describe("processImagePath", () => {
  it("reads a local image file and returns base64 data URI", async () => {
    const sharp = (await import("sharp")).default;
    const testDir = join(import.meta.dir, "__fixtures__");
    await Bun.$`mkdir -p ${testDir}`;
    const testFile = join(testDir, "test-image.jpg");
    await Bun.write(
      testFile,
      await sharp({
        create: { width: 10, height: 10, channels: 3, background: "red" },
      })
        .jpeg()
        .toBuffer()
    );

    const result = await processImagePath(testFile);

    expect(result.type).toBe("base64");
    expect(result.base64.length).toBeGreaterThan(0);
    expect(() => Buffer.from(result.base64, "base64")).not.toThrow();
  });

  it("resizes images larger than 2048px on longest edge", async () => {
    const sharp = (await import("sharp")).default;
    const testDir = join(import.meta.dir, "__fixtures__");
    await Bun.$`mkdir -p ${testDir}`;
    const testFile = join(testDir, "large-image.png");
    await Bun.write(
      testFile,
      await sharp({
        create: { width: 4096, height: 2048, channels: 3, background: "blue" },
      })
        .png()
        .toBuffer()
    );

    const result = await processImagePath(testFile);

    expect(result.type).toBe("base64");
    const base64Data = result.base64;
    const buffer = Buffer.from(base64Data, "base64");
    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBeLessThanOrEqual(2048);
    expect(metadata.height).toBeLessThanOrEqual(2048);
  });

  it("resolves relative paths against cwd", async () => {
    const sharp = (await import("sharp")).default;
    const testDir = join(import.meta.dir, "__fixtures__");
    await Bun.$`mkdir -p ${testDir}`;
    const testFile = join(testDir, "relative-test.jpg");
    await Bun.write(
      testFile,
      await sharp({
        create: { width: 10, height: 10, channels: 3, background: "green" },
      })
        .jpeg()
        .toBuffer()
    );

    const cwd = process.cwd();
    const relativePath = testFile.replace(cwd + "/", "");
    const result = await processImagePath(relativePath);

    expect(result.type).toBe("base64");
    expect(result.base64.length).toBeGreaterThan(0);
    expect(() => Buffer.from(result.base64, "base64")).not.toThrow();
  });

  it("throws when file does not exist", async () => {
    expect(processImagePath("/nonexistent/image.png")).rejects.toThrow(
      "Image file not found"
    );
  });

  it("throws when file is not a valid image", async () => {
    const testDir = join(import.meta.dir, "__fixtures__");
    await Bun.$`mkdir -p ${testDir}`;
    const testFile = join(testDir, "not-an-image.txt");
    await Bun.write(testFile, "this is not an image");

    expect(processImagePath(testFile)).rejects.toThrow(
      "Failed to process image"
    );
  });
});
