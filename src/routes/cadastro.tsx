import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/motion/AuthForm";
import { pageHead } from "@/lib/head";
export const Route=createFileRoute("/cadastro")({head:()=>pageHead("Criar conta","Cadastre-se para criar vídeos com a IA MRO."),component:()=> <AuthForm mode="signup"/>});
