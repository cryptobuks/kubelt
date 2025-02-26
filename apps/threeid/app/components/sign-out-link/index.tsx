import { useSubmit } from "@remix-run/react";
import Text, {
    TextColor,
    TextSize,
    TextWeight,
  } from "~/components/typography/Text";

export default function SignOut({className} : {className: string}) {
    let submit = useSubmit();

    return (
        <a className={className}
            style={{cursor: "pointer"}}
            onClick={() =>
                submit(null, { method: "post", action: `/auth/signout/` })
            }
            >
            <Text
                className="truncate"
                size={TextSize.Base}
                weight={TextWeight.Medium500}
                color={TextColor.Gray400}
            >
                Sign Out
            </Text>  
        </a>
    )
}