import { createFileRoute,redirect } from "@tanstack/react-router";
import {pageHead} from "@/lib/head";
export const Route=createFileRoute("/custos")({head:()=>pageHead("Custos administrativos","Custos do estúdio na administração protegida MotionMRO."),beforeLoad:()=>{throw redirect({to:"/admin/custos"});}});
