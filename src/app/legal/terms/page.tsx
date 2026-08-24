import { LegalPage } from "@/components/LegalPage";
import { AVAILABLE_IN, COMPANY, CONSUMER_DISPUTES } from "@/lib/company";
import { MINIMUM_AGE, TERMS_VERSION } from "@/lib/legal";

export const metadata = {
  title: "Terms",
  description:
    "The rules of playing Upside Arena. Play money only, nothing redeemable, and nothing here is advice.",
};

const markets = AVAILABLE_IN.join(" and ");

export default function TermsPage() {
  return (
    <LegalPage title="Terms" version={TERMS_VERSION}>
      <p>
        Upside Arena is a game. You play with pretend money against other people.
        These terms are the agreement between you and us. They say what you can
        expect from us, what we expect from you, and what happens if something
        goes wrong. Please read them. By using Arena you agree to them.
      </p>

      <h2>1. Who you are dealing with</h2>
      <p>
        Arena is run by {COMPANY.legalName}, a private limited company in{" "}
        {COMPANY.country} (registry code {COMPANY.registryCode}). Registered
        office: {COMPANY.address}. VAT ID {COMPANY.vatId}.
      </p>
      <p>
        Product help:{" "}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>.
        Questions about these terms:{" "}
        <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>.
      </p>
      <p>
        We also run {COMPANY.siblingProduct}, the same company&rsquo;s other
        product. It has its own terms and its own account. Using one does not
        sign you up for the other.
      </p>

      <h2>2. What Arena is, and what it is not</h2>
      <p>
        Arena is for entertainment and learning. You are given pretend money,
        you pick real companies, and you find out at the end of the week how
        your picks did compared to everyone else in your league.
      </p>
      <p>
        <strong>Nothing in Arena is investment advice.</strong> Nothing in it is
        a recommendation to buy or sell anything. We are not your broker, your
        adviser or your agent, and we do not manage money for you. Doing well in
        Arena does not mean you will do well with real money. If you are
        deciding what to do with real money, speak to someone qualified in your
        own country.
      </p>
      <p>
        Arena is not connected to, endorsed by, sponsored by or affiliated with
        any company whose share price appears in the game. Company names and
        ticker symbols are used only to identify them.
      </p>

      <h2>3. No real money is ever at stake</h2>
      <ul>
        <li>You never deposit money to play, and you never win money.</li>
        <li>
          The money in your portfolio is pretend. It has no cash value, it
          cannot be cashed out, exchanged, sold or transferred to anyone, and it
          is not a currency, a token, a security or property of any kind.
        </li>
        <li>
          Anything you unlock or buy in the game is decoration. You are given a
          personal, non-transferable permission to use it inside Arena. You do
          not own it, it has no cash value, and it ends when your account ends.
        </li>
        <li>
          <strong>
            Nothing you can buy will ever change your score, your chances of
            winning, or what you are allowed to do in the game.
          </strong>{" "}
          Money only ever buys decoration or convenience.
        </li>
        <li>
          Arena is not gambling. There is no wager, no stake and no prize with
          any cash value.
        </li>
      </ul>

      <h2>4. Who can play</h2>
      <p>
        Under 13 is never allowed. You must be {MINIMUM_AGE} or older to hold an
        account, which is the same rule {COMPANY.siblingProduct} uses. We use{" "}
        {MINIMUM_AGE} because some countries in Europe set that as the age you
        can agree to this kind of service by yourself.
      </p>
      <p>
        If we find out an account holder is younger, we will close the account
        and delete the data as described in our privacy policy.
      </p>
      <p>
        Arena is currently offered to people in {markets}. If you use it from
        somewhere else, you are responsible for whether that is allowed where
        you are, and some parts may not work.
      </p>
      <p>
        You may hold one account. You must not let anyone else use it, and you
        must not use anyone else&rsquo;s.
      </p>

      <h2>5. Your account</h2>
      <p>
        Give us accurate information and keep your sign-in details to yourself.
        Anything done through your account is treated as done by you, unless you
        tell us it was not. If you think someone else has got into your account,
        email us straight away.
      </p>
      <p>
        You can close your account at any time from your profile page. What
        happens to your data is set out in our privacy policy.
      </p>

      <h2>6. Playing fairly</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Use scripts, bots, automated tools or any other means to place trades
          or to play on your behalf.
        </li>
        <li>Hold more than one account, or arrange with others to fix results.</li>
        <li>
          Post anything abusive, hateful, threatening, harassing, deceptive,
          obscene or unlawful, anywhere other players can see it, including in a
          name, a player tag, a league name or a message.
        </li>
        <li>
          Post anything that is not yours to post, or that breaks someone
          else&rsquo;s rights.
        </li>
        <li>
          Try to break, overload, probe or work around any part of the service,
          or get at data you are not meant to see.
        </li>
        <li>
          Copy, scrape or resell any part of Arena, or use it to build a
          competing product.
        </li>
        <li>Pretend to be us, or to be someone you are not.</li>
      </ul>
      <p>
        If you break these rules we may remove what you posted, limit your
        account, reset a result, or close the account. Where it is reasonable to
        do so we will tell you why first and give you a chance to respond. For
        anything serious, or anything unlawful, we may act immediately.
      </p>

      <h2>7. What you put into Arena</h2>
      <p>
        Anything you write or upload stays yours. You give us permission to
        store it, display it and share it with the other players it is meant for,
        so that we can run the game. That permission is free of charge, and it
        ends when you delete the content or close your account, except for copies
        we have to keep by law or in ordinary backups for a short time.
      </p>
      <p>
        You are responsible for what you post, and you confirm you have the
        right to post it. We do not check everything in advance, but we can
        remove anything that breaks these terms.
      </p>

      <h2>8. Reporting something that should not be here</h2>
      <p>
        If you see content that breaks these terms, or that infringes your
        copyright or another right, email{" "}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>.
        Tell us what the content is, where you saw it, why it should come down,
        and how to reach you. If you are reporting copyright, please confirm you
        are the owner or are acting for them.
      </p>
      <p>
        We look at every report and act where the report is justified. We will
        tell you what we decided. If we remove something you posted, we will tell
        you why and you can reply to us and ask us to look again.
      </p>

      <h2>9. Our part of Arena</h2>
      <p>
        Arena itself, including its software, design, text, artwork and names,
        belongs to us or to the people we license it from. You may use it to play
        the game and for nothing else. These terms do not give you any ownership
        of it.
      </p>

      <h2>10. Market prices</h2>
      <p>
        Prices in Arena are delayed by roughly fifteen minutes and come from
        outside providers. They may be wrong, late, incomplete or missing, and a
        provider may stop supplying them. We do not promise they are accurate,
        and we are not responsible for what a provider gets wrong. Do not rely on
        them for anything outside the game.
      </p>

      <h2>11. Paid features</h2>
      <p>
        <strong>The game itself is free and stays free.</strong> Portfolios,
        leagues, streaks, standings and results are not behind a payment, and
        there are no adverts. There are two optional things you can pay for, and
        neither of them changes anything about how you are scored.
      </p>

      <h3>Arena Plus</h3>
      <p>
        A subscription that renews automatically until you stop it. Before you
        pay anything, you are shown the price, the currency, and how often you
        will be charged. Your receipt says the same. It gives you more streak
        freezes, more and larger leagues, your full history, and two titles only
        members can wear.
      </p>
      <p>
        <strong>You can cancel at any time, yourself, in one tap</strong>, from
        the Arena Plus page. We will never ask you to phone or email us to stop
        paying. Cancelling takes effect at the end of the period you have already
        paid for, and you keep everything until then. We do not refund part of a
        period you have already used, except where the law says we must.
      </p>
      <p>
        If a payment fails we do not take anything away straight away. Your card
        provider is given a few days to retry, and we tell you so you can fix it.
      </p>
      <p>
        If we change the price, we will tell you before it takes effect and you
        can cancel before being charged the new amount.
      </p>

      <h3>Arena Coins</h3>
      <p>
        Coins are bought outright in bundles of a fixed size for a fixed price,
        and are spent on decoration. Every bundle says exactly how many coins you
        get and exactly what it costs before you pay. Every item says exactly
        what it costs before you buy it.
      </p>
      <p>
        <strong>
          There are no randomised bundles, boxes or packs of any kind.
        </strong>{" "}
        You always see precisely what you are buying.
      </p>
      <p>
        <strong>Coins are not money.</strong> They have no cash value, cannot be
        exchanged for money, cannot be sold, given away or moved to another
        account, and are not refundable once spent. If you close your account, or
        we close it, any unspent coins are gone. If we ever stop the game we will
        give reasonable notice so you can spend what you hold.
      </p>

      <h3>Changing your mind</h3>
      <p>
        Where the law gives you a period to change your mind after buying digital
        content, you have it. By starting a subscription or buying coins you are
        asking us to give you access immediately, and you accept that once we
        have, that right ends. We tell you this at the point of purchase as well
        as here.
      </p>

      <h3>The rule that does not move</h3>
      <p>
        <strong>
          Money never changes your score, your ranking, your odds, your starting
          balance or what you are able to trade.
        </strong>{" "}
        Everyone starts every week with the same amount, whether they have paid
        us anything or not. This is not a promise about our current plans. It is
        what the product is.
      </p>
      <p>
        Payments are handled by Stripe. We never see or store your card details.
      </p>

      <h2>12. The game will change</h2>
      <p>
        Arena is a live product. We add things, remove things and adjust the
        rules of the game. We may change or stop any feature. If we make a change
        that takes away something significant you were relying on, we will tell
        you in advance where we reasonably can.
      </p>
      <p>
        We try to keep Arena running, but we cannot promise it will always be
        available. It may be down for maintenance, or because something outside
        our control has gone wrong.
      </p>

      <h2>13. Ending this agreement</h2>
      <p>
        You can stop using Arena and close your account whenever you like.
      </p>
      <p>
        We may close or suspend your account if you break these terms, if we have
        to for legal reasons, or if we stop offering Arena. Unless the law stops
        us, we will give you reasonable notice and a way to get your data first.
        If we stop offering Arena entirely, we will give you as much notice as we
        reasonably can.
      </p>
      <p>
        When an account ends, the pretend money and the decoration in it end with
        it. They had no cash value, so nothing is refundable.
      </p>

      <h2>14. What we promise, and what we do not</h2>
      <p>
        We will provide Arena with reasonable care and skill. Beyond that, and as
        far as the law allows, we provide it as it is. We do not promise that it
        will be uninterrupted, error free, secure against every attack, or that
        the prices, scores or standings in it will always be correct.
      </p>
      <p>
        If you are a consumer, you have rights under the law where you live that
        this section cannot take away. Nothing here affects those rights.
      </p>

      <h2>15. Limits on our responsibility</h2>
      <p>
        We are responsible for loss we cause you that we could reasonably have
        expected when you agreed to these terms. We are not responsible for:
      </p>
      <ul>
        <li>Anything you decide to do with real money.</li>
        <li>Loss of profit, income, business or opportunity.</li>
        <li>
          Loss caused by something outside our reasonable control, such as a
          failure at a supplier, a network problem, or an event we could not have
          prevented.
        </li>
        <li>Loss caused by you breaking these terms.</li>
      </ul>
      <p>
        Where the law allows us to put a limit on the total amount we owe you,
        that limit is the greater of the amount you have paid us in the twelve
        months before the problem, and one hundred euros. Arena is free, so for
        most people that is one hundred euros.
      </p>
      <p>
        Nothing in these terms limits our responsibility for death or personal
        injury caused by our negligence, for fraud, or for anything else that the
        law does not allow us to limit.
      </p>

      <h2>16. Changes to these terms</h2>
      <p>
        We may update these terms. Every version is dated, and the date at the
        top tells you which one is current.
      </p>
      <p>
        If a change matters to you, we will tell you in the app or by email
        before it takes effect, and we will ask you to agree again. If you do not
        agree, you can close your account. Small corrections that do not affect
        your rights, such as fixing a typo or a broken link, take effect when we
        publish them.
      </p>

      <h2>17. If something goes wrong between us</h2>
      <p>
        Email{" "}
        <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>{" "}
        first and tell us what happened. Most things are quicker to sort out that
        way, and we will reply.
      </p>
      <p>
        If we cannot sort it out and you are a consumer in the European Union,
        you can take it to the {CONSUMER_DISPUTES.englishName} (
        {CONSUMER_DISPUTES.name}) in {COMPANY.country}, free of charge, at{" "}
        <a href={CONSUMER_DISPUTES.url} rel="noreferrer noopener" target="_blank">
          {CONSUMER_DISPUTES.url}
        </a>
        . You can also use a dispute body in your own country if there is one.
        Using one of these is optional, and it does not stop you going to court.
      </p>

      <h2>18. Which law applies, and where</h2>
      <p>
        These terms are governed by the law of {COMPANY.country}.
      </p>
      <p>
        If you are a consumer, that choice does not take away the protections you
        get automatically under the law of the country you live in, and it does
        not decide where you can go to court. You can always bring a claim in the
        courts of the country you live in, and if we bring a claim against you we
        will bring it there too.
      </p>

      <h2>19. Other things worth knowing</h2>
      <ul>
        <li>
          If a court finds part of these terms cannot be enforced, the rest still
          applies.
        </li>
        <li>
          If we do not enforce something straight away, we have not given up the
          right to enforce it later.
        </li>
        <li>
          We may transfer this agreement to another company, for example if our
          business is sold. Your rights are not reduced by that. You cannot
          transfer your account to someone else.
        </li>
        <li>
          These terms, together with the privacy policy, are the whole agreement
          between us about Arena.
        </li>
        <li>
          These terms are written in English. A translation is for convenience,
          and the English version is the one that applies.
        </li>
      </ul>

      <h2>20. How to reach us</h2>
      <p>
        {COMPANY.legalName}, {COMPANY.address}, {COMPANY.country}.
      </p>
      <p>
        Product help:{" "}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>.
        Questions about these terms, or anything about your data:{" "}
        <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>.
        See also our <a href="/legal/privacy">privacy policy</a>.
      </p>
    </LegalPage>
  );
}
