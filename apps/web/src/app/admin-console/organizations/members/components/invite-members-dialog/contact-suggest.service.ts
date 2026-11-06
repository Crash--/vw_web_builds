import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

export interface ContactSuggestion {
  name: string;
  email: string;
}

export const CONTACT_SUGGEST_LIMIT = 10;

/**
 * Asks the Twake Pass server for people who have an account on this instance. The route lives at
 * the root of the vault origin, not under /api, hence the explicit base URL.
 */
@Injectable({ providedIn: "root" })
export class ContactSuggestService {
  private readonly apiService = inject(ApiService);
  private readonly accountService = inject(AccountService);

  /** Resolves to an empty list when the route fails, so the e-mail field stays free text. */
  async suggest(query: string): Promise<ContactSuggestion[]> {
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const path = `/contacts/suggest?q=${encodeURIComponent(query)}&limit=${CONTACT_SUGGEST_LIMIT}`;
      const response = await this.apiService.send(
        "GET",
        path,
        null,
        userId,
        true,
        window.location.origin,
      );
      return Array.isArray(response)
        ? response.filter((c) => typeof c?.email === "string" && c.email !== "")
        : [];
    } catch {
      return [];
    }
  }
}
