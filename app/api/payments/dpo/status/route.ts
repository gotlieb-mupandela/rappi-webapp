import { readDpoPaymentStatus } from "@/lib/dpo-payment-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRequestClient } from "@/lib/supabase/request";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return readDpoPaymentStatus(request, {
    async createRequestClient(incoming) {
      const supabase = await createRequestClient(incoming);
      return {
        auth: {
          async getUser() {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            return { data: { user: user?.id ? { id: user.id } : null } };
          },
        },
      };
    },
    async findOwnedPayment(companyRef, userId) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("payments")
        .select("status, order_id")
        .eq("company_ref", companyRef)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return { data: null, error: { message: error.message } };
      return { data, error: null };
    },
  });
}
