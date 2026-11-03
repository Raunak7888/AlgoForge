import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** When set, the control is a real link. */
    href?: string;
}

export function InteractiveHoverButton({ children, className, href, ...props }: Props) {
    const cls = cn("group bg-foreground/10 relative inline-block w-auto cursor-pointer overflow-hidden rounded-full p-2 px-6 text-center font-semibold", className);
    const body = (
        <>
            <div className="flex items-center justify-center gap-2">
                <div className="bg-accent h-2 w-2 rounded-full transition-all duration-1000 group-hover:scale-[100.8]"></div>
                <span className="inline-block text-accent transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0">{children}</span>
            </div>
            <div className="text-foreground absolute top-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 opacity-0 transition-all duration-700 group-hover:-translate-x-5 group-hover:opacity-100">
                <span>{children}</span>
                <ArrowRight />
            </div>
        </>
    );
    return href ? (
        <Link href={href} className={cls}>{body}</Link>
    ) : (
        <button type="button" className={cls} {...props}>{body}</button>
    );
}
