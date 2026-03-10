import { useMutation } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { useAuthSession } from "./session";

export function useAppleExchangeMutation() {
  const { signIn } = useAuthSession();

  return useMutation({
    mutationFn: (input: { identityToken: string; authorizationCode: string; nonce: string }) =>
      apiClient.appleExchange(input),
    onSuccess: async (session) => {
      await signIn(session);
    }
  });
}

export function useMagicLinkRequestMutation() {
  return useMutation({
    mutationFn: (input: { email: string }) => apiClient.requestMagicLink(input)
  });
}

export function useMagicLinkVerifyMutation() {
  const { signIn } = useAuthSession();

  return useMutation({
    mutationFn: (input: { token: string }) => apiClient.verifyMagicLink(input),
    onSuccess: async (session) => {
      await signIn(session);
    }
  });
}

export function useMeQueryMutation() {
  return useMutation({
    mutationFn: () => apiClient.me()
  });
}
