import React from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../lib/AuthContext";
import { TrendingUp } from "lucide-react";

export function LoginPage() {
  const { login } = useAuth();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 24,
      background: 'var(--bg-base)'
    }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: '48px 32px', textAlign: 'center' }}>
        
        {/* Logo */}
        <div style={{
          width: 56,
          height: 56,
          margin: '0 auto 24px',
          background: 'linear-gradient(135deg, var(--shopee-orange), var(--shopee-orange-light))',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          boxShadow: '0 8px 24px rgba(238, 77, 45, 0.4)'
        }}>
          <TrendingUp size={28} />
        </div>

        {/* Headings */}
        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
          Đăng nhập hệ thống
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.5 }}>
          Shopee Analytics cung cấp báo cáo độc lập và an toàn cho từng người dùng riêng biệt.
        </p>

        {/* Google Logic Container */}
        <div style={{
          padding: 24,
          background: 'var(--bg-input)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
            Tiếp tục với Google
          </span>
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              if (credentialResponse.credential) {
                login(credentialResponse.credential);
              }
            }}
            onError={() => {
              console.error("Login Failed");
              alert("Đăng nhập thất bại. Vui lòng thử lại.");
            }}
            useOneTap
            shape="rectangular"
            theme="filled_black"
          />
        </div>

        {/* Footer info */}
        <div style={{ marginTop: 32, fontSize: 12, color: 'var(--text-muted)' }}>
          © 2026 Shopee Analytics Platform
        </div>
      </div>
    </div>
  );
}
