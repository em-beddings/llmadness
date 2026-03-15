import {
  siAnthropic,
  siGooglegemini,
  siMinimax,
  siX
} from "simple-icons";
import { ProviderBrand, getProviderLabel } from "@/lib/provider-brand";

const ICONS: Partial<Record<ProviderBrand, { path: string; hex: string }>> = {
  anthropic: siAnthropic,
  "google-gemini": siGooglegemini,
  minimax: siMinimax,
  xai: siX
};

function ProviderIcon({ brand }: { brand: ProviderBrand }) {
  const icon = ICONS[brand];
  if (!icon) {
    return null;
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d={icon.path} fill={`#${icon.hex}`} />
    </svg>
  );
}

export function ProviderLogo({ brand }: { brand: ProviderBrand }) {
  const label = getProviderLabel(brand);
  const hasIcon = Boolean(ICONS[brand]);

  return (
    <span
      aria-label={label}
      className={`provider-logo provider-logo-${brand} ${hasIcon ? "provider-logo-icon" : "provider-logo-wordmark"}`}
      title={label}
    >
      {hasIcon ? <ProviderIcon brand={brand} /> : <span>{label}</span>}
    </span>
  );
}
