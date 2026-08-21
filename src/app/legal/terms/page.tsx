import { LegalPage } from "@/components/LegalPage";
import { MINIMUM_AGE, TERMS_VERSION } from "@/lib/legal";

export const metadata = { title: "Terms" };

/*
  Plain-language draft. A qualified attorney must review this, and the privacy
  policy, before Arena takes a single payment.
*/
export default function TermsPage() {
  return (
    <LegalPage title="Terms" version={TERMS_VERSION}>
      <p>
        Upside Arena is a game. You play with pretend money against other people.
        Reading these terms tells you what you can expect from us and what we
        expect from you.
      </p>

      <h2>This is a game, not investing</h2>
      <p>
        Arena is for entertainment and learning. Nothing in it is investment
        advice, and nothing in it is a recommendation to buy or sell anything.
        We are not your broker and we are not your adviser. If you are deciding
        what to do with real money, talk to someone qualified.
      </p>
      <p>
        Arena is not connected to, endorsed by, or affiliated with any company
        whose share price appears in the game.
      </p>

      <h2>No real money is at stake</h2>
      <ul>
        <li>You never deposit money to play, and you never win money.</li>
        <li>
          The money in your portfolio is pretend. It has no cash value, it
          cannot be cashed out, and it cannot be transferred to anyone.
        </li>
        <li>
          Anything you unlock or buy in the game is decoration. It has no cash
          value, cannot be sold or transferred, and disappears if your account
          closes.
        </li>
        <li>
          Nothing you can buy will ever change your score, your odds of winning,
          or what you are allowed to trade in the game.
        </li>
      </ul>

      <h2>Who can play</h2>
      <p>
        You must be {MINIMUM_AGE} or older to hold an account. If we learn that
        an account holder is younger, we will close the account.
      </p>

      <h2>Playing fairly</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use scripts, bots or automated tools to place trades.</li>
        <li>Hold more than one account, or play through someone else&rsquo;s.</li>
        <li>
          Put anything abusive, hateful, deceptive or unlawful into a league
          name, a message, or anywhere else other players can see it.
        </li>
        <li>Try to break, overload or work around any part of the service.</li>
      </ul>
      <p>
        We can suspend or close an account that breaks these rules, and we can
        remove content that does.
      </p>

      <h2>Market prices</h2>
      <p>
        Prices in Arena are delayed by roughly fifteen minutes and come from
        outside providers. They may be wrong, late or missing. Do not rely on
        them for anything outside the game.
      </p>

      <h2>Your account</h2>
      <p>
        Keep your sign-in details to yourself. You can close your account at any
        time from your profile page, and we will erase your data as described in
        the <a href="/legal/privacy">privacy policy</a>.
      </p>

      <h2>What we promise, and what we do not</h2>
      <p>
        We work to keep Arena running, but we provide it as it is. We do not
        promise it will always be available, always be correct, or never lose
        data. To the fullest extent the law allows, we are not liable for any
        loss that comes from using it, and any liability we do have is limited
        to the amount you have paid us in the previous twelve months.
      </p>
      <p>
        Nothing here removes rights you have under the law where you live that
        cannot be signed away.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. If a change is significant, we will tell you
        in the app and ask you to agree again before you carry on playing.
      </p>

      <h2>Disagreements</h2>
      <p>
        If something goes wrong, email us first at app.support@upthink.ee and we
        will try to sort it out. These terms are governed by the laws of Estonia,
        and the courts of Estonia will decide anything that cannot be resolved
        between us.
      </p>
    </LegalPage>
  );
}
