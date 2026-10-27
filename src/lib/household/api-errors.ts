/** Map database exceptions to short Hebrew the settings screen can show. */
export function householdErrorMessage(raw: string | undefined): {
  status: number;
  error: string;
  message: string;
} {
  const text = raw ?? "";
  if (/already_in_household/.test(text)) {
    return {
      status: 409,
      error: "already_in_household",
      message: "כבר יש ארנק משותף לחשבון הזה.",
    };
  }
  if (/invite_not_found|invalid_invite/.test(text)) {
    return {
      status: 404,
      error: "invite_not_found",
      message: "ההזמנה לא בתוקף, או שכבר השתמשו בה.",
    };
  }
  if (/not_owner/.test(text)) {
    return {
      status: 403,
      error: "not_owner",
      message: "רק מי שפתח את הארנק יכול לעשות את זה.",
    };
  }
  if (/owner_must_remove_members/.test(text)) {
    return {
      status: 409,
      error: "owner_must_remove_members",
      message: "קודם מסירים את בני הבית, ואז אפשר לסגור את הארנק.",
    };
  }
  if (/invalid_email/.test(text)) {
    return {
      status: 400,
      error: "invalid_email",
      message: "כתובת המייל לא נראית תקינה.",
    };
  }
  if (/member_not_found/.test(text)) {
    return {
      status: 404,
      error: "member_not_found",
      message: "בן הבית לא נמצא בארנק.",
    };
  }
  if (/does not exist|schema cache|Could not find the/i.test(text)) {
    return {
      status: 503,
      error: "migration_required",
      message: "צריך להריץ פעם אחת את מיגרציית הארנק ב־Supabase. היא עדיין לא הופעלה.",
    };
  }
  return {
    status: 500,
    error: "household_failed",
    message: "הפעולה על הארנק המשותף נכשלה.",
  };
}
