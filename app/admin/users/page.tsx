"use client";

import {
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type UserRole =
  | "admin"
  | "cashier"
  | "stock_manager";

type User = {
  id: string;
  name: string;
  role: UserRole;
  pin_defined: boolean;
};

type Feedback =
  | {
      type:
        | "success"
        | "error";
      message: string;
    }
  | null;

function Spinner({
  dark = false,
}: {
  dark?: boolean;
}) {
  return (
    <span
      className={`h-4 w-4 animate-spin rounded-full border-2 ${
        dark
          ? "border-[#1E4D3A]/20 border-t-[#1E4D3A]"
          : "border-white/30 border-t-white"
      }`}
    />
  );
}

export default function UsersPage() {
  const t =
    useTranslations(
      "AdminUsers"
    );

  const [
    users,
    setUsers,
  ] = useState<User[]>([]);

  const [
    name,
    setName,
  ] = useState("");

  const [
    role,
    setRole,
  ] =
    useState<UserRole>(
      "cashier"
    );

  const [
    usersLoading,
    setUsersLoading,
  ] = useState(true);

  const [
    creating,
    setCreating,
  ] = useState(false);

  const [
    resettingUserId,
    setResettingUserId,
  ] = useState<
    string | null
  >(null);

  const [
    deletingUserId,
    setDeletingUserId,
  ] = useState<
    string | null
  >(null);

  const [
    userToReset,
    setUserToReset,
  ] = useState<User | null>(
    null
  );

  const [
    userToDelete,
    setUserToDelete,
  ] = useState<User | null>(
    null
  );

  const [
    feedback,
    setFeedback,
  ] =
    useState<Feedback>(
      null
    );

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          setFeedback(null);
        },
        3500
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [feedback]);

  const notify = (
    type:
      | "success"
      | "error",
    message: string
  ) => {
    setFeedback({
      type,
      message,
    });
  };

  const loadUsers =
    async () => {
      try {
        const response =
          await fetch(
            "/api/users",
            {
              cache:
                "no-store",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          notify(
            "error",
            data.error ||
              t("errors.loadUsers")
          );

          return false;
        }

        setUsers(data);

        return true;
      } catch {
        notify(
          "error",
          t("errors.loadUsers")
        );

        return false;
      } finally {
        setUsersLoading(
          false
        );
      }
    };

  useEffect(() => {
    loadUsers();
  }, []);

  const createUser =
    async () => {
      if (creating) {
        return;
      }

      const cleanName =
        name.trim();

      if (!cleanName) {
        notify(
          "error",
          t("errors.employeeNameRequired")
        );

        return;
      }

      setCreating(true);

      try {
        const response =
          await fetch(
            "/api/users",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    name:
                      cleanName,
                    role,
                  }
                ),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          notify(
            "error",
            data.error ||
              t("errors.createUser")
          );

          return;
        }

        setName("");
        setRole(
          "cashier"
        );

        await loadUsers();

        notify(
          "success",
          t(
            "feedback.userAdded",
            {
              name:
                cleanName,
            }
          )
        );
      } catch {
        notify(
          "error",
          t("errors.createUser")
        );
      } finally {
        setCreating(false);
      }
    };

  const resetPin =
    async () => {
      if (
        !userToReset ||
        resettingUserId
      ) {
        return;
      }

      setResettingUserId(
        userToReset.id
      );

      try {
        const response =
          await fetch(
            `/api/users/${userToReset.id}/reset-pin`,
            {
              method: "POST",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          notify(
            "error",
            data.error ||
              t("errors.resetPin")
          );

          return;
        }

        const userName =
          userToReset.name;

        setUserToReset(
          null
        );

        await loadUsers();

        notify(
          "success",
          t(
            "feedback.pinReset",
            {
              name:
                userName,
            }
          )
        );
      } catch {
        notify(
          "error",
          t("errors.resetPin")
        );
      } finally {
        setResettingUserId(
          null
        );
      }
    };

  const deleteUser =
    async () => {
      if (
        !userToDelete ||
        deletingUserId
      ) {
        return;
      }

      const userId =
        userToDelete.id;

      const userName =
        userToDelete.name;

      setDeletingUserId(
        userId
      );

      try {
        const response =
          await fetch(
            "/api/users",
            {
              method:
                "DELETE",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    id:
                      userId,
                  }
                ),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          notify(
            "error",
            data.error ||
              t("errors.deleteUser")
          );

          return;
        }

        setUserToDelete(
          null
        );

        await loadUsers();

        notify(
          "success",
          t(
            "feedback.userDeleted",
            {
              name:
                userName,
            }
          )
        );
      } catch {
        notify(
          "error",
          t("errors.deleteUser")
        );
      } finally {
        setDeletingUserId(
          null
        );
      }
    };

  const roleLabel = (
    userRole: UserRole
  ) => {
    if (
      userRole === "admin"
    ) {
      return t("roles.admin.label");
    }

    if (
      userRole ===
      "cashier"
    ) {
      return t("roles.cashier.label");
    }

    return t("roles.stockManager.label");
  };

  const roleDescription = (
    userRole: UserRole
  ) => {
    if (
      userRole === "admin"
    ) {
      return t("roles.admin.access");
    }

    if (
      userRole ===
      "cashier"
    ) {
      return t("roles.cashier.access");
    }

    return t("roles.stockManager.access");
  };

  const getRoleStyle = (
    userRole: UserRole
  ) => {
    if (
      userRole === "admin"
    ) {
      return "bg-[#F3EFE8] text-[#745F4F]";
    }

    if (
      userRole ===
      "stock_manager"
    ) {
      return "bg-[#FFF6E9] text-[#946021]";
    }

    return "bg-[#EDF5EF] text-[#2E6A50]";
  };

  const adminCount =
    users.filter(
      (user) =>
        user.role ===
        "admin"
    ).length;

  const cashierCount =
    users.filter(
      (user) =>
        user.role ===
        "cashier"
    ).length;

  const stockCount =
    users.filter(
      (user) =>
        user.role ===
        "stock_manager"
    ).length;

  return (
    <main className="min-h-screen bg-[#F5F2EB] p-4 md:p-6">
      {/* FEEDBACK */}
      {feedback && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <div
            aria-live="polite"
            className={`rounded-2xl border px-4 py-3 shadow-xl ${
              feedback.type ===
              "success"
                ? "border-[#C7DACD] bg-[#EDF5EF] text-[#1E4D3A]"
                : "border-[#EDC7C0] bg-[#FFF1EE] text-[#A74435]"
            }`}
          >
            <p className="text-sm font-semibold">
              {
                feedback.message
              }
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <header className="mb-7">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1E4D3A] text-lg font-black text-white">
              M
            </div>

            <div>
              <p className="text-lg font-black tracking-[-0.03em] text-[#1F2924]">
                MAIDA
              </p>

              <p className="text-xs text-[#7A817C]">
                {t("administration")}
              </p>
            </div>
          </div>

          <div className="mt-7">
            <Link
              href="/admin"
              className="inline-flex min-h-10 items-center text-sm font-semibold text-[#567362]"
            >
              {t("actions.backAdmin")}
            </Link>

            <p className="mt-3 text-sm font-semibold text-[#2E6A50]">
              {t("eyebrow")}
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#1F2924] md:text-4xl">
              {t("title")}
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-[#737A75]">
              {t("description")}
            </p>
          </div>
        </header>

        {/* KPI */}
        {!usersLoading && (
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[22px] bg-[#1E4D3A] p-4 text-white shadow-sm">
              <p className="text-xs font-medium text-white/70">
                {t("eyebrow")}
              </p>

              <p
                className="mt-2 text-2xl font-black"
                dir="ltr"
              >
                {
                  users.length
                }
              </p>

              <p className="mt-2 text-[11px] text-white/60">
                {t("title")}
              </p>
            </div>

            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
              <p className="text-xs text-[#7A817C]">
                {t("stats.cashiers")}
              </p>

              <p
                className="mt-2 text-2xl font-black text-[#1F2924]"
                dir="ltr"
              >
                {
                  cashierCount
                }
              </p>
            </div>

            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
              <p className="text-xs text-[#7A817C]">
                {t("stats.admins")}
              </p>

              <p
                className="mt-2 text-2xl font-black text-[#1F2924]"
                dir="ltr"
              >
                {
                  adminCount
                }
              </p>
            </div>

            <div className="rounded-[22px] border border-[#E8E5DE] bg-white p-4 shadow-sm">
              <p className="text-xs text-[#7A817C]">
                {t("stats.stock")}
              </p>

              <p
                className="mt-2 text-2xl font-black text-[#1F2924]"
                dir="ltr"
              >
                {
                  stockCount
                }
              </p>
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* CRÉATION */}
          <section className="h-fit rounded-[26px] border border-[#E8E5DE] bg-white p-5 shadow-sm lg:sticky lg:top-6 md:p-6">
            <div>
              <p className="text-sm font-semibold text-[#2E6A50]">
                {t("create.eyebrow")}
              </p>

              <h2 className="mt-1 text-xl font-black tracking-tight text-[#1F2924]">
                {t("create.title")}
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#7A817C]">
                {t("create.description")}
              </p>
            </div>

            <div className="mt-6">
              <label
                htmlFor="employee-name"
                className="text-sm font-semibold text-[#343D38]"
              >
                {t("create.name")}
              </label>

              <input
                id="employee-name"
                type="text"
                value={name}
                onChange={(
                  event
                ) =>
                  setName(
                    event.target
                      .value
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    createUser();
                  }
                }}
                disabled={
                  creating
                }
                placeholder={t(
                  "create.namePlaceholder"
                )}
                className="mt-2 h-12 w-full rounded-2xl border border-[#E0DED7] bg-[#FAFAF7] px-4 text-[#1F2924] outline-none transition placeholder:text-[#A0A6A2] focus:border-[#8EB19A] focus:bg-white focus:ring-4 focus:ring-[#DDE8DF] disabled:opacity-60"
              />
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-[#343D38]">
                {t("create.role")}
              </p>

              <div className="mt-2 space-y-2">
                {[
                  {
                    value:
                      "cashier" as UserRole,
                    label:
                      t("roles.cashier.label"),
                    description:
                      t("roles.cashier.description"),
                  },
                  {
                    value:
                      "stock_manager" as UserRole,
                    label:
                      t("roles.stockManager.label"),
                    description:
                      t("roles.stockManager.description"),
                  },
                  {
                    value:
                      "admin" as UserRole,
                    label:
                      t("roles.admin.label"),
                    description:
                      t("roles.admin.access"),
                  },
                ].map(
                  (item) => {
                    const selected =
                      role ===
                      item.value;

                    return (
                      <button
                        type="button"
                        key={
                          item.value
                        }
                        onClick={() =>
                          setRole(
                            item.value
                          )
                        }
                        disabled={
                          creating
                        }
                        className={
                          selected
                            ? "flex min-h-[62px] w-full items-center justify-between rounded-2xl border border-[#8EB19A] bg-[#EDF5EF] px-4 text-start transition"
                            : "flex min-h-[62px] w-full items-center justify-between rounded-2xl border border-[#E5E2DA] bg-white px-4 text-start transition hover:bg-[#FAFAF7]"
                        }
                      >
                        <div>
                          <p
                            className={
                              selected
                                ? "font-semibold text-[#1E4D3A]"
                                : "font-semibold text-[#343D38]"
                            }
                          >
                            {
                              item.label
                            }
                          </p>

                          <p className="mt-0.5 text-xs text-[#8A918C]">
                            {
                              item.description
                            }
                          </p>
                        </div>

                        <span
                          className={`h-4 w-4 rounded-full border-2 ${
                            selected
                              ? "border-[#1E4D3A] bg-[#1E4D3A] shadow-[inset_0_0_0_3px_#EDF5EF]"
                              : "border-[#C8CCC8]"
                          }`}
                        />
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={
                createUser
              }
              disabled={
                creating ||
                !name.trim()
              }
              className="mt-6 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#1E4D3A] px-4 font-bold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {creating ? (
                <>
                  <Spinner />
                  {t("create.creating")}
                </>
              ) : (
                t("create.submit")
              )}
            </button>
          </section>

          {/* ÉQUIPE */}
          <section className="overflow-hidden rounded-[26px] border border-[#E8E5DE] bg-white shadow-sm">
            <div className="border-b border-[#EEECE6] p-5 md:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-[#1F2924]">
                    {t("eyebrow")}
                  </h2>

                  <p className="mt-1 text-sm text-[#7A817C]">
                    {t("team.description")}
                  </p>
                </div>

                {!usersLoading && (
                  <span className="rounded-full bg-[#F1F2EF] px-3 py-1.5 text-xs font-semibold text-[#68706B]">
                    <span dir="ltr">
                      {
                        users.length
                      }
                    </span>{" "}
                    {users.length === 1
                      ? t("team.account")
                      : t("team.accounts")}
                  </span>
                )}
              </div>
            </div>

            {usersLoading ? (
              <div className="flex min-h-64 flex-col items-center justify-center p-8">
                <Spinner
                  dark
                />

                <p className="mt-3 text-sm font-medium text-[#7A817C]">
                  {t("team.loading")}
                </p>
              </div>
            ) : users.length ===
              0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F1] text-[#8A918C]">
                  —
                </div>

                <h3 className="mt-4 font-bold text-[#343D38]">
                  {t("team.emptyTitle")}
                </h3>

                <p className="mt-1 text-sm text-[#8A918C]">
                  {t("team.emptyDescription")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EEECE6]">
                {users.map(
                  (user) => {
                    const resetting =
                      resettingUserId ===
                      user.id;

                    const deleting =
                      deletingUserId ===
                      user.id;

                    const isLastAdmin =
                      user.role ===
                        "admin" &&
                      adminCount <= 1;

                    return (
                      <article
                        key={
                          user.id
                        }
                        className="p-4 sm:p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate font-bold text-[#1F2924] sm:text-lg">
                                {
                                  user.name
                                }
                              </h3>

                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getRoleStyle(
                                  user.role
                                )}`}
                              >
                                {roleLabel(
                                  user.role
                                )}
                              </span>
                            </div>

                            <p className="mt-1 text-sm text-[#8A918C]">
                              {roleDescription(
                                user.role
                              )}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <span
                              className={
                                user.pin_defined
                                  ? "inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#EDF5EF] px-3 text-xs font-semibold text-[#2E6A50]"
                                  : "inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#FFF6E9] px-3 text-xs font-semibold text-[#946021]"
                              }
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  user.pin_defined
                                    ? "bg-[#3D7D5E]"
                                    : "bg-[#D4862D]"
                                }`}
                              />

                              {user.pin_defined
                                ? "PIN actif"
                                : "PIN à créer"}
                            </span>

                            {user.pin_defined && (
                              <button
                                type="button"
                                onClick={() =>
                                  setUserToReset(
                                    user
                                  )
                                }
                                disabled={
                                  resettingUserId !==
                                    null ||
                                  deletingUserId !==
                                    null
                                }
                                className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#E3E0D8] px-3 text-sm font-semibold text-[#68706B] transition hover:bg-[#F7F7F3] disabled:opacity-40"
                              >
                                {resetting ? (
                                  <>
                                    <Spinner
                                      dark
                                    />
                                    {t("pin.resetting")}
                                  </>
                                ) : (
                                  t("pin.reset")
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                setUserToDelete(
                                  user
                                )
                              }
                              disabled={
                                isLastAdmin ||
                                resettingUserId !==
                                  null ||
                                deletingUserId !==
                                  null
                              }
                              title={
                                isLastAdmin
                                  ? t(
                                      "delete.lastAdminTitle"
                                    )
                                  : t(
                                      "delete.userTitle",
                                      {
                                        name:
                                          user.name,
                                      }
                                    )
                              }
                              className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#E8C7C1] bg-[#FFF8F6] px-3 text-sm font-semibold text-[#B24D3E] transition hover:bg-[#FFF1EE] disabled:cursor-not-allowed disabled:border-[#E5E2DA] disabled:bg-[#F7F7F3] disabled:text-[#A4A8A5] disabled:opacity-70"
                            >
                              {deleting ? (
                                <>
                                  <Spinner
                                    dark
                                  />
                                  {t("delete.deleting")}
                                </>
                              ) : isLastAdmin ? (
                                t("delete.lastAdmin")
                              ) : (
                                t("delete.action")
                              )}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </div>

        <footer className="mt-9 border-t border-[#E3E0D8] py-5">
          <p className="text-center text-xs text-[#9A9F9B]">
            {t("footer")}
          </p>
        </footer>
      </div>

      {/* CONFIRMATION RESET PIN */}
      {userToReset && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#17201B]/55 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[30px] bg-white p-6 shadow-2xl sm:rounded-[30px] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#DDDAD3] sm:hidden" />

            <p className="text-sm font-semibold text-[#B24D3E]">
              {t("resetModal.eyebrow")}
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-[#1F2924]">
              {t("resetModal.title")}
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#737A75]">
              {t.rich(
                "resetModal.description",
                {
                  name:
                    userToReset.name,
                  strong: (
                    chunks
                  ) => (
                    <strong className="text-[#343D38]">
                      {chunks}
                    </strong>
                  ),
                }
              )}
            </p>

            <div className="mt-5 rounded-2xl bg-[#FFF6E9] p-4">
              <p className="text-sm font-semibold text-[#8D5519]">
                {t("resetModal.notice")}
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setUserToReset(
                    null
                  )
                }
                disabled={
                  resettingUserId !==
                  null
                }
                className="min-h-[52px] flex-1 rounded-2xl border border-[#E3E0D8] font-semibold text-[#68706B] disabled:opacity-40"
              >
                {t("actions.back")}
              </button>

              <button
                type="button"
                onClick={
                  resetPin
                }
                disabled={
                  resettingUserId !==
                  null
                }
                className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#B84B3C] px-3 font-semibold text-white disabled:cursor-wait disabled:opacity-50"
              >
                {resettingUserId ? (
                  <>
                    <Spinner />
                    {t("pin.resetting")}
                  </>
                ) : (
                  t("resetModal.confirm")
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION SUPPRESSION */}
      {userToDelete && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#17201B]/55 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[30px] bg-white p-6 shadow-2xl sm:rounded-[30px] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#DDDAD3] sm:hidden" />

            <p className="text-sm font-semibold text-[#B24D3E]">
              {t("deleteModal.eyebrow")}
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-[#1F2924]">
              {t("deleteModal.title")}
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#737A75]">
              {t.rich(
                "deleteModal.description",
                {
                  name:
                    userToDelete.name,
                  strong: (
                    chunks
                  ) => (
                    <strong className="text-[#343D38]">
                      {chunks}
                    </strong>
                  ),
                }
              )}
            </p>

            <div className="mt-5 rounded-2xl bg-[#FFF1EE] p-4">
              <p className="text-sm font-semibold text-[#A74435]">
                {t("deleteModal.warningTitle")}
              </p>

              <p className="mt-1 text-xs leading-5 text-[#9B665D]">
                {t("deleteModal.warningDescription")}
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setUserToDelete(
                    null
                  )
                }
                disabled={
                  deletingUserId !==
                  null
                }
                className="min-h-[52px] flex-1 rounded-2xl border border-[#E3E0D8] font-semibold text-[#68706B] disabled:opacity-40"
              >
                {t("actions.cancel")}
              </button>

              <button
                type="button"
                onClick={
                  deleteUser
                }
                disabled={
                  deletingUserId !==
                  null
                }
                className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#B84B3C] px-3 font-semibold text-white transition hover:bg-[#A64134] disabled:cursor-wait disabled:opacity-50"
              >
                {deletingUserId ? (
                  <>
                    <Spinner />
                    {t("deleteModal.eyebrow")}...
                  </>
                ) : (
                  t("delete.action")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}