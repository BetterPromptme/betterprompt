import { describe, expect, it } from "bun:test";
import { generateZodSchema, INPUT_TYPE } from "./schema";

describe("generateZodSchema", () => {
  it("rejects invalid value for single select variable", () => {
    const schema = generateZodSchema({
      variables: {
        tone: {
          type: INPUT_TYPE.SELECT,
          options: {
            friendly: "Friendly",
            formal: "Formal",
          },
        },
      },
      images: [],
    });

    const valid = schema.safeParse({
      textInputs: {
        tone: "friendly",
      },
      imageInputs: [],
    });
    expect(valid.success).toBe(true);

    const invalid = schema.safeParse({
      textInputs: {
        tone: "casual",
      },
      imageInputs: [],
    });
    expect(invalid.success).toBe(false);
  });

  it("enforces min and max for multi select variable", () => {
    const schema = generateZodSchema({
      variables: {
        channels: {
          type: INPUT_TYPE.SELECT,
          options: {
            email: "Email",
            sms: "SMS",
            push: "Push",
          },
          multiple: {
            min: 1,
            max: 2,
          },
        },
      },
      images: [],
    });

    const tooFew = schema.safeParse({
      textInputs: {
        channels: [],
      },
      imageInputs: [],
    });
    expect(tooFew.success).toBe(false);

    const tooMany = schema.safeParse({
      textInputs: {
        channels: ["email", "sms", "push"],
      },
      imageInputs: [],
    });
    expect(tooMany.success).toBe(false);

    const invalidOption = schema.safeParse({
      textInputs: {
        channels: ["email", "fax"],
      },
      imageInputs: [],
    });
    expect(invalidOption.success).toBe(false);

    const valid = schema.safeParse({
      textInputs: {
        channels: ["email", "sms"],
      },
      imageInputs: [],
    });
    expect(valid.success).toBe(true);
  });

  it("keeps text validation behavior for required and allowEmpty text variables", () => {
    const schema = generateZodSchema({
      variables: {
        title: {
          type: INPUT_TYPE.TEXT,
        },
        note: {
          type: INPUT_TYPE.TEXT,
          allowEmpty: true,
        },
      },
      images: [],
    });

    const invalid = schema.safeParse({
      textInputs: {
        title: "",
        note: "",
      },
      imageInputs: [],
    });
    expect(invalid.success).toBe(false);

    const valid = schema.safeParse({
      textInputs: {
        title: "hello",
        note: "",
      },
      imageInputs: [],
    });
    expect(valid.success).toBe(true);
  });
});
