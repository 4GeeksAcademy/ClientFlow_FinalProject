import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    interfaceText,
    supportedInterfaceLocales,
    validateInterfaceMessages,
} from "../../src/front/i18n/messages.mjs";
import {
    literalTranslations,
    translateLiteral,
    validateLiteralTranslations,
} from "../../src/front/i18n/literalTranslations.mjs";

test("every interface message has English, Spanish and Portuguese text", () => {
    assert.deepEqual(validateInterfaceMessages(), []);
    assert.deepEqual(validateLiteralTranslations(), []);
    assert.deepEqual(supportedInterfaceLocales, ["en", "es", "pt"]);

    const expectedKeys = Object.keys(interfaceText("en"));
    for (const locale of supportedInterfaceLocales) {
        assert.deepEqual(Object.keys(interfaceText(locale)), expectedKeys);
        assert.ok(Object.values(interfaceText(locale)).every((value) => value.trim()));
    }
});

test("legacy operational phrases switch in either direction without a reload", () => {
    for (const translations of literalTranslations) {
        for (const targetLocale of supportedInterfaceLocales) {
            assert.equal(
                translateLiteral(translations.es, targetLocale),
                translations[targetLocale]
            );
        }
    }
});

test("language preference is persisted and the document language is updated", () => {
    const source = readFileSync(
        new URL("../../src/front/context/LanguageContext.jsx", import.meta.url),
        "utf8"
    );

    assert.match(source, /localStorage\.getItem\("app_locale"\)/);
    assert.match(source, /localStorage\.setItem\("app_locale", locale\)/);
    assert.match(source, /document\.documentElement\.lang = locale/);
    assert.match(source, /MutationObserver/);
});

test("core operational screens have English and Portuguese translations", () => {
    const phrases = {
        "Gestión de Clientes": ["Client management", "Gestão de clientes"],
        "Gestiona y convierte nuevas oportunidades.": ["Manage and convert new opportunities.", "Gerencie e converta novas oportunidades."],
        "Gestión de Trabajos": ["Job management", "Gestão de trabalhos"],
        "Datos de contacto y dirección principal.": ["Contact details and primary address.", "Dados de contato e endereço principal."],
        "Pendiente": ["Pending", "Pendente"],
    };

    for (const [spanish, [english, portuguese]] of Object.entries(phrases)) {
        assert.equal(translateLiteral(spanish, "en"), english);
        assert.equal(translateLiteral(spanish, "pt"), portuguese);
    }
});
