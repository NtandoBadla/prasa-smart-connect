import { Train } from "lucide-react";
import { useLang } from "@/lib/i18n";

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="mt-16 bg-primary text-primary-foreground">
      <div className="container mx-auto grid gap-8 px-4 py-10 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-destructive">
              <Train className="h-5 w-5" />
            </div>
            <span className="font-bold">PRASA</span>
          </div>
          <p className="mt-3 text-sm opacity-80">
            Passenger Rail Agency of South Africa — moving commuters safely and reliably.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider">{t("footerTravel")}</h4>
          <ul className="space-y-2 text-sm opacity-90">
            <li>{t("footerLiveTrains")}</li>
            <li>{t("footerFares")}</li>
            <li>{t("footerStations")}</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider">{t("footerAbout")}</h4>
          <ul className="space-y-2 text-sm opacity-90">
            <li>{t("footerAboutPrasa")}</li>
            <li>{t("footerMetrorail")}</li>
            <li>{t("footerNewsroom")}</li>
            <li>{t("footerCareers")}</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider">{t("footerContact")}</h4>
          <ul className="space-y-2 text-sm opacity-90">
            <li>Call Centre: 0800 65 64 63</li>
            <li>info@prasa.com</li>
            <li>Umjantshi House, 30 Wolmarans St, Johannesburg</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-dark">
        <div className="container mx-auto flex flex-col gap-2 px-4 py-4 text-xs opacity-80 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} Passenger Rail Agency of South Africa</span>
          <span>{t("footerDemo")}</span>
        </div>
      </div>
    </footer>
  );
}
