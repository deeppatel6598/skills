import { describe, expect, it } from "vitest";
import { detectLanguage, t, toBCP47 } from "@/lib/lang";

describe("language detection", () => {
  it("detects common languages", () => {
    expect(detectLanguage("¿dónde están ubicados?")).toBe("es");
    expect(detectLanguage("bonjour, je voudrais un rendez-vous")).toBe("fr");
    expect(detectLanguage("Hallo, ich möchte einen Termin buchen")).toBe("de");
    expect(detectLanguage("olá, quero marcar uma consulta")).toBe("pt");
    expect(detectLanguage("नमस्ते, मुझे अपॉइंटमेंट चाहिए")).toBe("hi");
    expect(detectLanguage("hello, where are you located?")).toBe("en");
    expect(detectLanguage("")).toBe("en");
  });

  it("maps to BCP-47 and localizes phrases", () => {
    expect(toBCP47("es")).toBe("es-ES");
    expect(toBCP47("hi")).toBe("hi-IN");
    expect(t("es", "askWhichService")).toContain("reservar");
    expect(t("fr", "askWhichService").toLowerCase()).toContain("réserver");
    expect(t("xx", "catchAll")).toBe(t("en", "catchAll")); // unknown lang -> english
  });
});
