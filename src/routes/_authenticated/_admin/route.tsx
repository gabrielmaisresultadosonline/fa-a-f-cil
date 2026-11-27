import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { checkAdmin } from "@/lib/saas.functions";
export const Route=createFileRoute("/_authenticated/_admin")({beforeLoad:async()=>{if(!(await checkAdmin()))throw redirect({to:"/dashboard"});},component:()=> <Outlet/>});
