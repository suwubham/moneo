import { Bricolage_Grotesque, Fraunces, JetBrains_Mono } from "next/font/google";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-bricolage",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  style: "italic",
  weight: "variable",
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const fontVars = `${bricolage.variable} ${fraunces.variable} ${jetbrains.variable}`;
