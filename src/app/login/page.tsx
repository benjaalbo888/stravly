import { AccountScreen } from "@/app/cuenta/screen";

export default async function Login({ searchParams }: { searchParams: Promise<{ invitacion?: string }> }) {
  return <AccountScreen mode="login" invite={(await searchParams).invitacion === "1"} />;
}
