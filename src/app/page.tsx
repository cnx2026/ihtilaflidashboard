import { UserProvider } from "@/context/UserContext";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <UserProvider>
      <Dashboard />
    </UserProvider>
  );
}
