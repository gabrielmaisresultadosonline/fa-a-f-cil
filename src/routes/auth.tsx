import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/motion/AuthForm";
import { pageHead } from "@/lib/head";
export const Route=createFileRoute("/auth")({head:()=>pageHead("Entrar","Entre no seu estúdio privado MotionMRO."),component:()=> <AuthForm mode="login"/>});
