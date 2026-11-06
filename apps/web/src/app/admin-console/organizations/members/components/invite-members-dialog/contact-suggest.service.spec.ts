import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";

import { ContactSuggestService } from "./contact-suggest.service";

const USER_ID = "user-1" as UserId;

describe("ContactSuggestService", () => {
  let apiService: MockProxy<ApiService>;
  let service: ContactSuggestService;

  beforeEach(() => {
    apiService = mock<ApiService>();
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: USER_ID } as any);
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: apiService },
        { provide: AccountService, useValue: accountService },
      ],
    });
    service = TestBed.inject(ContactSuggestService);
  });

  it("queries the root of the vault origin as the active user", async () => {
    apiService.send.mockResolvedValue([{ name: "User Two", email: "two@example.com" }]);

    const result = await service.suggest("t w&");

    expect(apiService.send).toHaveBeenCalledWith(
      "GET",
      "/contacts/suggest?q=t%20w%26&limit=10",
      null,
      USER_ID,
      true,
      window.location.origin,
    );
    expect(result).toEqual([{ name: "User Two", email: "two@example.com" }]);
  });

  it("returns no suggestion when the request fails", async () => {
    apiService.send.mockRejectedValue(new Error("401"));

    expect(await service.suggest("tw")).toEqual([]);
  });

  it("ignores a response that is not a list", async () => {
    apiService.send.mockResolvedValue({ message: "nope" });

    expect(await service.suggest("tw")).toEqual([]);
  });
});
