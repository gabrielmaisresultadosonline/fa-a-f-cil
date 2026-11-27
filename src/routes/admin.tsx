import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/motion/AuthForm";
import { pageHead } from "@/lib/head";
export const Route=createFileRoute("/admin")({head:()=>pageHead("Acesso administrativo","Acesso restrito à administração MotionMRO."),component:()=> <AuthForm mode="admin"/>});
