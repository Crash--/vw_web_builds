import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";

import { GroupApiService } from "../../../core";
import { MemberActionsService } from "../../services";

import { ContactSuggestService } from "./contact-suggest.service";
import {
  InviteMembersDialogComponent,
  InviteMembersDialogParams,
} from "./invite-members-dialog.component";

const ORG_ID = "org-1" as OrganizationId;
const USER_ID = "user-1" as UserId;

interface Harness {
  fixture: ComponentFixture<InviteMembersDialogComponent>;
  component: InviteMembersDialogComponent;
  memberActionsService: MockProxy<MemberActionsService>;
  contactSuggestService: MockProxy<ContactSuggestService>;
}

async function createComponent(): Promise<Harness> {
  const organization = Object.assign(new Organization(), {
    id: ORG_ID,
    seats: 100,
    productTierType: ProductTierType.Enterprise,
    useGroups: false,
    useCustomPermissions: true,
  });

  const organizationService = mock<OrganizationService>();
  organizationService.organizations$.mockReturnValue(of([organization]));

  const accountService = mock<AccountService>();
  accountService.activeAccount$ = of({ id: USER_ID } as any);

  const collectionAdminService = mock<CollectionAdminService>();
  collectionAdminService.collectionAdminViews$.mockReturnValue(of([]));

  const i18nService = mock<I18nService>();
  i18nService.t.mockImplementation((key) => key);

  const memberActionsService = mock<MemberActionsService>();
  memberActionsService.invite.mockResolvedValue({ success: true });

  const contactSuggestService = mock<ContactSuggestService>();
  contactSuggestService.suggest.mockResolvedValue([]);

  const params: InviteMembersDialogParams = {
    organizationId: ORG_ID,
    isOnSecretsManagerStandalone: false,
    occupiedSeatCount: 0,
    allOrganizationUsers: [],
  };

  await TestBed.configureTestingModule({
    imports: [InviteMembersDialogComponent],
    providers: [
      { provide: DIALOG_DATA, useValue: params },
      { provide: DialogRef, useValue: mock<DialogRef>() },
      { provide: I18nService, useValue: i18nService },
      { provide: CollectionAdminService, useValue: collectionAdminService },
      { provide: GroupApiService, useValue: mock<GroupApiService>() },
      { provide: AccountService, useValue: accountService },
      { provide: OrganizationService, useValue: organizationService },
      { provide: ToastService, useValue: mock<ToastService>() },
      { provide: MemberActionsService, useValue: memberActionsService },
      { provide: ContactSuggestService, useValue: contactSuggestService },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(InviteMembersDialogComponent);

  return {
    fixture,
    component: fixture.componentInstance,
    memberActionsService,
    contactSuggestService,
  };
}

/** Reaches past `protected` the way the template does, to drive the emails control. */
function setEmails(component: InviteMembersDialogComponent, emails: string) {
  (component as any).formGroup.controls.emails.setValue(emails);
}

function invitedEmails(memberActionsService: MockProxy<MemberActionsService>): string[] {
  return memberActionsService.invite.mock.calls[0][1].emails;
}

describe("InviteMembersDialogComponent", () => {
  describe("submit", () => {
    it("sends the entered emails", async () => {
      const { component, memberActionsService } = await createComponent();

      setEmails(component, "user@bitwarden.com, user1@bitwarden.com");
      await component.submit();

      expect(invitedEmails(memberActionsService)).toEqual([
        "user@bitwarden.com",
        "user1@bitwarden.com",
      ]);
    });

    // A trailing comma is a common typo. Sending the resulting empty entry to the server fails the
    // whole invite with "Invalid Model State", so it's dropped instead.
    it("drops the empty entry left by a trailing comma", async () => {
      const { component, memberActionsService } = await createComponent();

      setEmails(component, "user@bitwarden.com, user1@bitwarden.com,");
      await component.submit();

      expect(invitedEmails(memberActionsService)).toEqual([
        "user@bitwarden.com",
        "user1@bitwarden.com",
      ]);
    });

    it("drops empty entries left by stray commas anywhere in the input", async () => {
      const { component, memberActionsService } = await createComponent();

      setEmails(component, ", user@bitwarden.com,, user1@bitwarden.com , ");
      await component.submit();

      expect(invitedEmails(memberActionsService)).toEqual([
        "user@bitwarden.com",
        "user1@bitwarden.com",
      ]);
    });

    it("does not invite when the input holds nothing but commas", async () => {
      const { component, memberActionsService } = await createComponent();

      setEmails(component, ",,");
      await component.submit();

      expect(memberActionsService.invite).not.toHaveBeenCalled();
    });
  });

  describe("email suggestions", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    async function typeAndWait(component: InviteMembersDialogComponent, emails: string) {
      setEmails(component, emails);
      await jest.advanceTimersByTimeAsync(250);
      return (component as any).emailSuggestions() as { label: string; value: string }[];
    }

    it("replaces only the address being typed", async () => {
      const { component, contactSuggestService } = await createComponent();
      contactSuggestService.suggest.mockResolvedValue([
        { name: "User Two", email: "two@example.com" },
        { name: "User One", email: "one@example.com" },
      ]);

      const suggestions = await typeAndWait(component, "one@example.com, tw");

      expect(contactSuggestService.suggest).toHaveBeenCalledWith("tw");
      expect(suggestions).toEqual([
        { label: "User Two", value: "one@example.com, two@example.com" },
      ]);
    });

    it("does not ask for fewer than two characters", async () => {
      const { component, contactSuggestService } = await createComponent();

      const suggestions = await typeAndWait(component, "a@b.c, t");

      expect(contactSuggestService.suggest).not.toHaveBeenCalled();
      expect(suggestions).toEqual([]);
    });
  });
});
