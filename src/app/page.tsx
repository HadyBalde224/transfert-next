"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, AlertCircle, Loader } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { usernameToEmail } from "@/lib/identifiant";

export default function AuthPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { addToast } = useToast();
  const router = useRouter();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!username.trim()) {
      newErrors.username = "Nom d'utilisateur requis";
    } else if (username.trim().length < 2) {
      newErrors.username = "Minimum 2 caractères";
    } else if (username.length > 50) {
      newErrors.username = "Maximum 50 caractères";
    }

    if (!password) {
      newErrors.password = "Mot de passe requis";
    } else if (password.length < 4) {
      newErrors.password = "Minimum 4 caractères";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const sanitizeInput = (input: string) => input.trim().replace(/[<>]/g, "");

  const handleLogin = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      addToast("Veuillez corriger les erreurs", "warning");
      return;
    }

    setLoading(true);

    try {
      const sanitizedUsername = sanitizeInput(username);
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(sanitizedUsername),
        password,
      });

      if (error) {
        throw error;
      }

      addToast(`Bienvenue ${sanitizedUsername}!`, "success", 1500);
      router.refresh();
      router.push("/dashboard");
    } catch {
      addToast("Identifiant ou mot de passe incorrect", "error");
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-6">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full relative overflow-hidden max-w-sm">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-blue-400"></div>

        <div className="text-center mb-8 mt-4">
          <div className="bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 p-4 rounded-full inline-block mb-3 border-2 border-blue-200">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-black text-gray-800">Connexion Sécurisée</h1>
          <p className="text-gray-500 text-sm mt-2">Accédez à votre compte</p>
        </div>

        {Object.values(errors).some(Boolean) && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg mb-6 flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-red-700 text-sm">
              {Object.values(errors).filter(Boolean).map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">
              Nom d&apos;utilisateur
            </label>
            <input
              type="text"
              placeholder="Entrez votre nom"
              required
              disabled={loading}
              maxLength={50}
              className={`w-full p-4 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium transition ${
                errors.username ? "border-red-400" : "border-gray-200 hover:border-gray-300"
              } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (errors.username) setErrors((prev) => ({ ...prev, username: "" }));
              }}
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">Mot de passe</label>
            <input
              type="password"
              placeholder="••••••••"
              required
              disabled={loading}
              className={`w-full p-4 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium transition ${
                errors.password ? "border-red-400" : "border-gray-200 hover:border-gray-300"
              } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl text-lg font-black shadow-lg transition flex items-center justify-center gap-2 ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:shadow-xl active:scale-95"
            }`}
          >
            {loading ? (
              <>
                <Loader size={20} className="animate-spin" />
                Connexion en cours...
              </>
            ) : (
              "Se Connecter"
            )}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-gray-600 text-center">
            🔒 <strong>Connexion sécurisée</strong> - Vos données sont protégées
          </p>
        </div>
      </div>
    </div>
  );
}
