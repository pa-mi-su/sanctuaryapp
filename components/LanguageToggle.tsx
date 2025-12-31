// components/LanguageToggle.tsx
import React, { useMemo, useState, useCallback } from "react";
import { View } from "react-native";
import { Button, Text } from "react-native-paper";
import i18n, { setLanguage, type AppLang as SupportedLanguage } from "../i18n";

type LangOption = { value: SupportedLanguage; label: string };

export function LanguageToggle({
  title,
  compact = true,
}: {
  title?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const currentLang = useMemo<SupportedLanguage>(() => {
    const lng = (i18n.language || "en").toLowerCase();
    if (lng.startsWith("es")) return "es";
    if (lng.startsWith("pl")) return "pl";
    if (lng.startsWith("tl")) return "tl";
    return "en";
  }, [i18n.language]);

  const options: LangOption[] = useMemo(
    () => [
      { value: "en", label: "EN" },
      { value: "es", label: "ES" },
      { value: "pl", label: "PL" },
      { value: "tl", label: "TL" },
    ],
    [],
  );

  const onPick = useCallback(
    async (lang: SupportedLanguage) => {
      if (busy || lang === currentLang) return;
      setBusy(true);
      try {
        await setLanguage(lang);
      } finally {
        setBusy(false);
      }
    },
    [busy, currentLang],
  );

  return (
    <View>
      {title ? (
        <Text style={{ opacity: 0.9, marginBottom: 8, fontWeight: "700" }}>
          {title}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => (
          <Button
            key={o.value}
            compact={compact}
            disabled={busy}
            mode={currentLang === o.value ? "contained" : "text"}
            onPress={() => onPick(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </View>
    </View>
  );
}
