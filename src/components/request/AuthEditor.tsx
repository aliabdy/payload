import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import {
  PasswordInput,
  PasswordInputControl,
  PasswordInputToggle,
} from "@ui-sdk/react/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import type { AuthDef, AuthType } from "../../types";

interface AuthEditorProps {
  auth: AuthDef;
  onChange: (auth: AuthDef) => void;
}

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: "none", label: "No auth" },
  { value: "bearer", label: "Bearer token" },
  { value: "basic", label: "Basic auth" },
  { value: "apiKey", label: "API key" },
];

function SecretField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <PasswordInput value={value} onValueChange={onChange}>
        <PasswordInputControl aria-label={label} />
        <PasswordInputToggle aria-label={`${label} visibility`} />
      </PasswordInput>
    </Field>
  );
}

export function AuthEditor({ auth, onChange }: AuthEditorProps) {
  const update = (patch: Partial<AuthDef>) => onChange({ ...auth, ...patch });

  return (
    <div className="field-stack">
      <Field>
        <FieldLabel>Auth type</FieldLabel>
        <Select
          value={auth.type}
          onValueChange={(value) =>
            value && update({ type: value as AuthType })
          }
        >
          <SelectTrigger aria-label="Auth type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="select-content">
            {AUTH_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value} label={type.label}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {auth.type === "bearer" ? (
        <SecretField
          label="Bearer token"
          value={auth.token}
          onChange={(token) => update({ token })}
        />
      ) : null}

      {auth.type === "basic" ? (
        <>
          <Field>
            <FieldLabel>Username</FieldLabel>
            <Input
              value={auth.username}
              onValueChange={(username) => update({ username })}
              aria-label="Username"
              spellCheck={false}
            />
          </Field>
          <SecretField
            label="Password"
            value={auth.password}
            onChange={(password) => update({ password })}
          />
        </>
      ) : null}

      {auth.type === "apiKey" ? (
        <>
          <Field>
            <FieldLabel>Key</FieldLabel>
            <Input
              value={auth.key}
              onValueChange={(key) => update({ key })}
              aria-label="API key name"
              spellCheck={false}
            />
          </Field>
          <SecretField
            label="API key value"
            value={auth.value}
            onChange={(value) => update({ value })}
          />
          <Field>
            <FieldLabel>Add to</FieldLabel>
            <Select
              value={auth.in}
              onValueChange={(value) =>
                value && update({ in: value as AuthDef["in"] })
              }
            >
              <SelectTrigger aria-label="API key location">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="select-content">
                <SelectItem value="header" label="Header">
                  Header
                </SelectItem>
                <SelectItem value="query" label="Query parameter">
                  Query parameter
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      ) : null}

      {auth.type === "none" ? (
        <p className="inline-empty">No authorization is sent with this request.</p>
      ) : null}
    </div>
  );
}
