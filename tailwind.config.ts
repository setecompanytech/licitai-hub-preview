import type { Config } from "tailwindcss";

/**
 * Tailwind — a régua do Design System v3 (19/09/2026).
 *
 * Tudo aqui aponta para os tokens de `src/index.css`: cor, sombra, raio e
 * gradiente. Nenhum valor de cor mora neste arquivo, e é assim que o tema
 * escuro repinta o app inteiro trocando só o bloco `.dark`.
 */
export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1520px",
      },
    },
    extend: {
      fontFamily: {
        // Uma família só na interface. `brand` fica com a marca (BrandLogo);
        // `heading` existe para o título poder mudar sem varrer os .tsx.
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        heading: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        brand: ["Manrope", "Inter", "ui-sans-serif", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      /**
       * Escala tipográfica — densidade de software operacional (comando de
       * 19/09/2026):
       *
       *   xs   12px  microtexto, metadado, rótulo de tabela
       *   sm   13px  texto secundário, célula de tabela, badge
       *   base 14px  texto padrão, botão, campo
       *   lg   16px  título de cartão
       *   xl   18px  subtítulo, título de modal
       *   2xl  20px  título de seção
       *   3xl  24px  número médio
       *   4xl  28px  título de página, KPI
       *   5xl  32px  KPI de destaque
       *
       * Disciplina: xs SÓ para metadados; sm para UI densa; leitura em base.
       */
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.125rem" }],
        base: ["0.875rem", { lineHeight: "1.25rem" }],
        lg: ["1rem", { lineHeight: "1.5rem" }],
        xl: ["1.125rem", { lineHeight: "1.625rem", letterSpacing: "-0.005em" }],
        "2xl": ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em" }],
        "3xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.012em" }],
        "4xl": ["1.75rem", { lineHeight: "2.25rem", letterSpacing: "-0.015em" }],
        "5xl": ["2rem", { lineHeight: "2.5rem", letterSpacing: "-0.02em" }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: {
          DEFAULT: "hsl(var(--foreground))",
          tertiary: "hsl(var(--foreground-tertiary))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          tint: "hsl(var(--primary-tint))",
          line: "hsl(var(--primary-line))",
          hover: "hsl(var(--primary-hover))",
        },
        // Teal tecnológico — o degrau vivo do verde, para IA e indicadores.
        teal: {
          DEFAULT: "hsl(var(--teal))",
          foreground: "hsl(var(--teal-foreground))",
        },
        // Navy da marca — estrutura: sidebar, tooltip, título institucional.
        navy: {
          DEFAULT: "hsl(var(--navy))",
          hover: "hsl(var(--navy-hover))",
          tint: "hsl(var(--navy-tint))",
        },
        // Azul corporativo — segundo tom institucional.
        brand: {
          navy: "hsl(var(--brand-navy))",
          green: "hsl(var(--brand-green))",
          blue: "hsl(var(--brand-blue))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          deep: "hsl(var(--gold-deep))",
          hi: "hsl(var(--gold-hi))",
          logo: "hsl(var(--logo-accent))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        // Estados com o trio: fundo tingido (`tint`), texto legível sobre ele
        // (`ink`) e borda (`line`). Substitui a composição de alfa na mão.
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          tint: "hsl(var(--destructive-tint))",
          ink: "hsl(var(--destructive-ink))",
          line: "hsl(var(--destructive-line))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          tint: "hsl(var(--success-tint))",
          ink: "hsl(var(--success-ink))",
          line: "hsl(var(--success-line))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          tint: "hsl(var(--warning-tint))",
          ink: "hsl(var(--warning-ink))",
          line: "hsl(var(--warning-line))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          tint: "hsl(var(--info-tint))",
          ink: "hsl(var(--info-ink))",
          line: "hsl(var(--info-line))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
          7: "hsl(var(--chart-7))",
          8: "hsl(var(--chart-8))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        nav: {
          DEFAULT: "hsl(var(--nav-bg))",
          foreground: "hsl(var(--nav-fg))",
          active: "hsl(var(--nav-active))",
          hover: "hsl(var(--nav-hover))",
          border: "hsl(var(--nav-border))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      /**
       * Raios (19/09): cartão 10px, botão e campo 8px, chip 6px, modal 12px,
       * herói 16px. Nada acima disso em componente corporativo.
       */
      borderRadius: {
        DEFAULT: "var(--radius-md)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius)",
        xl: "var(--radius-xl)",
        "2xl": "1rem",
        "3xl": "1rem",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-xl)",
        glow: "var(--shadow-glow)",
        "glow-sm": "var(--shadow-glow-sm)",
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-hero": "var(--gradient-hero)",
        "gradient-card": "var(--gradient-card)",
        "gradient-dark": "var(--gradient-dark)",
        "gradient-accent-subtle": "var(--gradient-accent-subtle)",
        "gradient-warm": "var(--gradient-warm)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--primary) / 0.3)" },
          "50%": { boxShadow: "0 0 16px 4px hsl(var(--primary) / 0.15)" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // "Voltar para o robô" no admin (17/09/2026): halo verde que bate e para.
        "piscar-verde": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--primary) / 0)" },
          "50%": { boxShadow: "0 0 0 6px hsl(var(--primary) / 0.3)" },
        },
        // Sininho com aviso novo do robô: balanço curto, depois parado.
        "sininho-tremer": {
          "0%, 24%, 100%": { transform: "rotate(0deg)" },
          "4%": { transform: "rotate(14deg)" },
          "8%": { transform: "rotate(-12deg)" },
          "12%": { transform: "rotate(8deg)" },
          "16%": { transform: "rotate(-5deg)" },
          "20%": { transform: "rotate(2deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out forwards",
        "slide-in-left": "slide-in-left 0.2s ease-out forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "count-up": "count-up 0.3s ease-out forwards",
        "piscar-verde": "piscar-verde 1.4s ease-in-out 4",
        "sininho-tremer": "sininho-tremer 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
