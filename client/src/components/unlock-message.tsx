import { Unlock } from "lucide-react";

export default function UnlockMessage() {
  return (
    <div className="mb-8">
      <div className="bg-gradient-to-r from-secondary to-primary text-white rounded-xl p-6 text-center">
        <Unlock className="mx-auto h-8 w-8 mb-3" />
        <h3 className="text-xl font-bold mb-2">Congratulations! You've unlocked the community!</h3>
        <p className="text-blue-100">Your idea has been submitted. Now you can explore and vote on other creative AI use cases.</p>
      </div>
    </div>
  );
}
